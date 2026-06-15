package controller

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type xunhuPayChannelConfig struct {
	AppID  string
	Secret string
}

func isXunhuPayMethod(method string) bool {
	return method == model.PaymentMethodXunhuPayWechat || method == model.PaymentMethodXunhuPayAlipay
}

func getXunhuPayChannelConfig(method string) xunhuPayChannelConfig {
	switch method {
	case model.PaymentMethodXunhuPayWechat:
		return xunhuPayChannelConfig{
			AppID:  setting.XunhuPayWechatAppID,
			Secret: setting.XunhuPayWechatSecret,
		}
	case model.PaymentMethodXunhuPayAlipay:
		return xunhuPayChannelConfig{
			AppID:  setting.XunhuPayAlipayAppID,
			Secret: setting.XunhuPayAlipaySecret,
		}
	default:
		return xunhuPayChannelConfig{}
	}
}

func isXunhuPayConfigured(method string) bool {
	cfg := getXunhuPayChannelConfig(method)
	return strings.TrimSpace(cfg.AppID) != "" && strings.TrimSpace(cfg.Secret) != ""
}

func getXunhuPayMinTopup(method string) int64 {
	minTopup := getPaymentMethodMinTopup(method, int64(operation_setting.MinTopUp))
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return decimal.NewFromInt(minTopup).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	return minTopup
}

func getPaymentMethodMinTopup(method string, fallback int64) int64 {
	if fallback <= 0 {
		fallback = 1
	}
	if strings.TrimSpace(method) == "" {
		return fallback
	}
	for _, payMethod := range operation_setting.GetEnabledPayMethods() {
		if payMethod["type"] != method {
			continue
		}
		raw := strings.TrimSpace(payMethod["min_topup"])
		if raw == "" {
			return fallback
		}
		minTopup, err := strconv.ParseFloat(raw, 64)
		if err != nil || minTopup <= 0 {
			return fallback
		}
		return int64(math.Ceil(minTopup))
	}
	return fallback
}

func getXunhuPayClient(method string) *service.XunhuPayClient {
	cfg := getXunhuPayChannelConfig(method)
	if strings.TrimSpace(cfg.AppID) == "" || strings.TrimSpace(cfg.Secret) == "" {
		return nil
	}
	return service.NewXunhuPayClient(cfg.AppID, cfg.Secret, setting.XunhuPayGateway)
}

func RequestXunhuPay(c *gin.Context, req EpayRequest) {
	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在或未启用"})
		return
	}
	if !isXunhuPayConfigured(req.PaymentMethod) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置虎皮椒支付信息"})
		return
	}
	if req.Amount < getXunhuPayMinTopup(req.PaymentMethod) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getXunhuPayMinTopup(req.PaymentMethod))})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	tradeNo := fmt.Sprintf("XHP%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: model.PaymentProviderXunhuPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒 创建充值订单失败 user_id=%d trade_no=%s payment_method=%s amount=%d error=%q", id, tradeNo, req.PaymentMethod, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	callBackAddress := service.GetCallbackAddress()
	notifyURL := strings.TrimRight(callBackAddress, "/") + "/api/user/xunhupay/notify"
	returnURL := paymentReturnPath("/console/topup")

	client := getXunhuPayClient(req.PaymentMethod)
	if client == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置虎皮椒支付信息"})
		return
	}
	result, err := client.CreatePayment(tradeNo, payMoney, fmt.Sprintf("TUC%d", req.Amount), notifyURL, returnURL)
	if err != nil {
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderXunhuPay, common.TopUpStatusFailed)
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒 拉起支付失败 user_id=%d trade_no=%s payment_method=%s amount=%d error=%q", id, tradeNo, req.PaymentMethod, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 充值订单创建成功 user_id=%d trade_no=%s payment_method=%s amount=%d money=%.2f open_order_id=%s", id, tradeNo, req.PaymentMethod, req.Amount, payMoney, result.OpenOrderID))
	if strings.TrimSpace(result.URLQRCode) == "" && strings.TrimSpace(result.URL) == "" {
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderXunhuPay, common.TopUpStatusFailed)
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒支付返回缺少二维码和支付链接 user_id=%d trade_no=%s payment_method=%s amount=%d open_order_id=%s", id, tradeNo, req.PaymentMethod, req.Amount, result.OpenOrderID))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付二维码获取失败，请检查虎皮椒通道配置"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒充值订单创建成功 user_id=%d trade_no=%s payment_method=%s amount=%d money=%.2f open_order_id=%s has_qrcode=%t has_payment_url=%t", id, tradeNo, req.PaymentMethod, req.Amount, payMoney, result.OpenOrderID, strings.TrimSpace(result.URLQRCode) != "", strings.TrimSpace(result.URL) != ""))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"trade_no":      tradeNo,
			"payment_url":   result.URL,
			"qrcode_url":    result.URLQRCode,
			"open_order_id": result.OpenOrderID,
			"amount":        strconv.FormatFloat(payMoney, 'f', 2, 64),
		},
	})
}

func XunhuPayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeNo := c.Request.Form.Get("trade_order_id")
	status := c.Request.Form.Get("status")
	appID := c.Request.Form.Get("appid")
	totalFeeRaw := c.Request.Form.Get("total_fee")
	if tradeNo == "" || appID == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 缺少必要参数 trade_no=%s appid=%s client_ip=%s", tradeNo, appID, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderXunhuPay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 订单支付网关不匹配 trade_no=%s order_provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	client := getXunhuPayClient(topUp.PaymentMethod)
	if client == nil || client.AppID != appID {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook appid 不匹配 trade_no=%s callback_appid=%s order_method=%s client_ip=%s", tradeNo, appID, topUp.PaymentMethod, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if !client.VerifyCallback(c.Request.Form) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 验签失败 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if status != "OD" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 忽略非成功状态 trade_no=%s status=%s client_ip=%s", tradeNo, status, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	payMoney, err := strconv.ParseFloat(totalFeeRaw, 64)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 金额格式错误 trade_no=%s total_fee=%s client_ip=%s", tradeNo, totalFeeRaw, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if queryResult, err := client.QueryOrder(tradeNo); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 查单失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	} else if queryResult.Status != "OD" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("虎皮椒 webhook 查单状态非成功 trade_no=%s query_status=%s client_ip=%s", tradeNo, queryResult.Status, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeXunhuPay(tradeNo, payMoney, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("虎皮椒 充值处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("虎皮椒 充值成功 trade_no=%s payment_method=%s money=%.2f client_ip=%s", tradeNo, topUp.PaymentMethod, payMoney, c.ClientIP()))
	_, _ = c.Writer.Write([]byte("success"))
}
