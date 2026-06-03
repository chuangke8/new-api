package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type dataMaintenanceCleanupRequest struct {
	Types      []string `json:"types"`
	StartTime  int64    `json:"start_time"`
	EndTime    int64    `json:"end_time"`
	BeforeTime int64    `json:"before_time"`
	DryRun     bool     `json:"dry_run"`
}

func GetDataMaintenanceSettings(c *gin.Context) {
	common.ApiSuccess(c, model.GetDataMaintenanceSettings())
}

func SaveDataMaintenanceSettings(c *gin.Context) {
	var settings model.DataMaintenanceSettings
	if err := common.DecodeJson(c.Request.Body, &settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}
	if err := model.SaveDataMaintenanceSettings(settings); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.GetDataMaintenanceSettings())
}

func RunDataMaintenanceCleanup(c *gin.Context) {
	var req dataMaintenanceCleanupRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}
	operatorName := strings.TrimSpace(strconv.Itoa(c.GetInt("id")))
	if user, err := model.GetUserById(c.GetInt("id"), false); err == nil && strings.TrimSpace(user.Username) != "" {
		operatorName = user.Username
	}
	result, err := model.RunDataMaintenanceCleanup(model.DataMaintenanceCleanupRequest{
		Types:        req.Types,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		BeforeTime:   req.BeforeTime,
		DryRun:       req.DryRun,
		OperatorID:   c.GetInt("id"),
		OperatorName: operatorName,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func ListDataMaintenanceLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	logs, err := model.ListDataMaintenanceLogs(limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, logs)
}
