package service

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type XunhuPayClient struct {
	AppID   string
	Secret  string
	Gateway string
	Client  *http.Client
}

type XunhuPayCreatePaymentResponse struct {
	URL         string `json:"url"`
	URLQRCode   string `json:"url_qrcode"`
	QRCodeURL   string `json:"qrcode_url"`
	CodeURL     string `json:"code_url"`
	PayURL      string `json:"pay_url"`
	OpenOrderID string `json:"open_order_id"`
}

type XunhuPayQueryOrderResponse struct {
	OpenOrderID string `json:"open_order_id"`
	Status      string `json:"status"`
}

func NewXunhuPayClient(appID, secret, gateway string) *XunhuPayClient {
	if strings.TrimSpace(gateway) == "" {
		gateway = "https://api.xunhupay.com"
	}
	return &XunhuPayClient{
		AppID:   strings.TrimSpace(appID),
		Secret:  strings.TrimSpace(secret),
		Gateway: strings.TrimRight(strings.TrimSpace(gateway), "/"),
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (x *XunhuPayClient) MakeSign(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key != "hash" && value != "" {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, params[key]))
	}
	raw := strings.Join(parts, "&") + x.Secret
	sum := md5.Sum([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (x *XunhuPayClient) VerifyCallback(values url.Values) bool {
	received := values.Get("hash")
	if received == "" {
		return false
	}
	params := make(map[string]string, len(values))
	for key, itemValues := range values {
		if len(itemValues) > 0 {
			params[key] = itemValues[0]
		}
	}
	return received == x.MakeSign(params)
}

func (x *XunhuPayClient) postJSON(path string, params map[string]string, target any) error {
	params["hash"] = x.MakeSign(params)
	bodyBytes, err := common.Marshal(params)
	if err != nil {
		return fmt.Errorf("xunhupay encode request failed: %w", err)
	}

	request, err := http.NewRequest(http.MethodPost, x.Gateway+path, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return fmt.Errorf("xunhupay create request failed: %w", err)
	}
	request.Header.Set("Content-Type", "application/json;charset=UTF-8")

	response, err := x.Client.Do(request)
	if err != nil {
		return fmt.Errorf("xunhupay http request failed: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("xunhupay read response failed: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("xunhupay http status %d: %s", response.StatusCode, string(responseBody))
	}

	var envelope struct {
		ErrCode int             `json:"errcode"`
		ErrMsg  string          `json:"errmsg"`
		Data    json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(responseBody, &envelope); err != nil {
		return fmt.Errorf("xunhupay decode response failed: %s", string(responseBody))
	}
	if envelope.ErrCode != 0 {
		return fmt.Errorf("xunhupay request failed: %s (code=%d)", envelope.ErrMsg, envelope.ErrCode)
	}
	if target == nil {
		return nil
	}
	if len(envelope.Data) > 0 && string(envelope.Data) != "null" {
		if err := common.Unmarshal(envelope.Data, target); err != nil {
			return fmt.Errorf("xunhupay decode response data failed: %w", err)
		}
		return nil
	}
	if err := common.Unmarshal(responseBody, target); err != nil {
		return fmt.Errorf("xunhupay decode response data failed: %w", err)
	}
	return nil
}

func (x *XunhuPayClient) CreatePayment(tradeOrderID string, totalFee float64, title, notifyURL, returnURL string) (*XunhuPayCreatePaymentResponse, error) {
	params := map[string]string{
		"version":        "1.1",
		"appid":          x.AppID,
		"trade_order_id": tradeOrderID,
		"total_fee":      fmt.Sprintf("%.2f", totalFee),
		"title":          title,
		"notify_url":     notifyURL,
		"return_url":     returnURL,
		"callback_url":   returnURL,
		"time":           fmt.Sprintf("%d", time.Now().Unix()),
		"nonce_str":      xunhuNonceString(32),
	}
	result := &XunhuPayCreatePaymentResponse{}
	if err := x.postJSON("/payment/do.html", params, result); err != nil {
		return nil, err
	}
	result.Normalize()
	return result, nil
}

func (r *XunhuPayCreatePaymentResponse) Normalize() {
	if r == nil {
		return
	}
	if strings.TrimSpace(r.URLQRCode) == "" {
		for _, value := range []string{r.QRCodeURL, r.CodeURL} {
			if strings.TrimSpace(value) != "" {
				r.URLQRCode = value
				break
			}
		}
	}
	if strings.TrimSpace(r.URL) == "" && strings.TrimSpace(r.PayURL) != "" {
		r.URL = r.PayURL
	}
}

func (x *XunhuPayClient) QueryOrder(tradeOrderID string) (*XunhuPayQueryOrderResponse, error) {
	params := map[string]string{
		"appid":           x.AppID,
		"out_trade_order": tradeOrderID,
		"time":            fmt.Sprintf("%d", time.Now().Unix()),
		"nonce_str":       xunhuNonceString(32),
	}
	result := &XunhuPayQueryOrderResponse{}
	if err := x.postJSON("/payment/query.html", params, result); err != nil {
		return nil, err
	}
	return result, nil
}

func xunhuNonceString(length int) string {
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	var builder strings.Builder
	builder.Grow(length)
	for i := 0; i < length; i++ {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			builder.WriteByte(alphabet[time.Now().UnixNano()%int64(len(alphabet))])
			continue
		}
		builder.WriteByte(alphabet[index.Int64()])
	}
	return builder.String()
}
