/**
此文件为旧版支付设置文件，如需增加新的参数、变量等，请在 payment_setting.go 中添加
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
*/

package operation_setting

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var Price = 7.3
var MinTopUp = 1
var USDExchangeRate = 7.3

var PayMethods = []map[string]string{
	{
		"name":  "支付宝",
		"color": "rgba(var(--semi-blue-5), 1)",
		"type":  "alipay",
	},
	{
		"name":  "微信",
		"color": "rgba(var(--semi-green-5), 1)",
		"type":  "wxpay",
	},
	{
		"name":      "自定义1",
		"color":     "black",
		"type":      "custom1",
		"min_topup": "50",
	},
}

func UpdatePayMethodsByJsonString(jsonString string) error {
	var rawMethods []map[string]interface{}
	if err := common.Unmarshal([]byte(jsonString), &rawMethods); err != nil {
		return err
	}
	PayMethods = make([]map[string]string, 0, len(rawMethods))
	for _, rawMethod := range rawMethods {
		method := make(map[string]string, len(rawMethod))
		for key, value := range rawMethod {
			method[key] = fmt.Sprintf("%v", value)
		}
		PayMethods = append(PayMethods, method)
	}
	return nil
}

func PayMethods2JsonString() string {
	jsonBytes, err := common.Marshal(PayMethods)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func ContainsPayMethod(method string) bool {
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method && IsPayMethodEnabled(payMethod) {
			return true
		}
	}
	return false
}

func IsPayMethodEnabled(payMethod map[string]string) bool {
	enabled, ok := payMethod["enabled"]
	return !ok || enabled != "false"
}

func HasPayMethod(method string) bool {
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method {
			return true
		}
	}
	return false
}

func GetEnabledPayMethods() []map[string]string {
	enabledMethods := make([]map[string]string, 0, len(PayMethods))
	for _, payMethod := range PayMethods {
		if IsPayMethodEnabled(payMethod) {
			enabledMethods = append(enabledMethods, payMethod)
		}
	}
	return enabledMethods
}
