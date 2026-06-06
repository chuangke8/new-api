package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type taskCenterResponse struct {
	ID               int64  `json:"id"`
	Source           string `json:"source"`
	SubmitSource     string `json:"submit_source"`
	SourceID         string `json:"source_id"`
	TaskID           string `json:"task_id"`
	UserID           int    `json:"user_id"`
	UsernameSnapshot string `json:"username_snapshot"`
	TaskType         string `json:"task_type"`
	Tags             string `json:"tags"`
	Model            string `json:"model"`
	Status           string `json:"status"`
	Cost             int    `json:"cost"`
	Remark           string `json:"remark"`
	SubmittedAt      int64  `json:"submitted_at"`
	CompletedAt      int64  `json:"completed_at"`
	Detail           string `json:"detail,omitempty"`
	RawRequest       string `json:"raw_request,omitempty"`
	RawResponse      string `json:"raw_response,omitempty"`
	ErrorMessage     string `json:"error_message"`
	ErrorDetail      string `json:"error_detail,omitempty"`
	CreatedAt        int64  `json:"created_at"`
	UpdatedAt        int64  `json:"updated_at"`
}

type updateTaskCenterRemarkRequest struct {
	Remark string `json:"remark"`
}

type stopTaskCenterBatchRequest struct {
	IDs []int64 `json:"ids"`
}

type stopTaskCenterResult struct {
	ID            int64  `json:"id"`
	TaskID        string `json:"task_id"`
	Stopped       bool   `json:"stopped"`
	RefundedQuota int    `json:"refunded_quota"`
	Message       string `json:"message"`
}

func parseTaskCenterQuery(c *gin.Context, admin bool) model.TaskCenterQueryParams {
	submittedStart, _ := strconv.ParseInt(firstNonEmpty(c.Query("submitted_start"), c.Query("start_timestamp")), 10, 64)
	submittedEnd, _ := strconv.ParseInt(firstNonEmpty(c.Query("submitted_end"), c.Query("end_timestamp")), 10, 64)
	return model.TaskCenterQueryParams{
		Keyword:        strings.TrimSpace(c.Query("keyword")),
		TaskType:       strings.TrimSpace(c.Query("task_type")),
		Status:         strings.TrimSpace(c.Query("status")),
		Model:          strings.TrimSpace(c.Query("model")),
		User:           strings.TrimSpace(c.Query("user")),
		Tag:            strings.TrimSpace(c.Query("tag")),
		SubmitSource:   strings.TrimSpace(c.Query("submit_source")),
		SubmittedStart: submittedStart,
		SubmittedEnd:   submittedEnd,
		UserID:         c.GetInt("id"),
		Admin:          admin,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func isTaskCenterAdmin(c *gin.Context) bool {
	return model.IsAdmin(c.GetInt("id"))
}

func taskCenterDetailForRole(detail string, includeAdminFields bool) string {
	if includeAdminFields || strings.TrimSpace(detail) == "" {
		return detail
	}
	var parsed model.TaskCenterDetail
	if err := common.UnmarshalJsonStr(detail, &parsed); err != nil {
		return detail
	}
	parsed.Metadata = nil
	b, err := common.Marshal(parsed)
	if err != nil {
		return detail
	}
	return string(b)
}

func taskCenterToResponse(record *model.TaskCenter, includeAdminFields bool) taskCenterResponse {
	response := taskCenterResponse{
		ID:               record.ID,
		Source:           record.Source,
		SubmitSource:     record.SubmitSource,
		SourceID:         record.SourceID,
		TaskID:           record.TaskID,
		UserID:           record.UserID,
		UsernameSnapshot: record.UsernameSnapshot,
		TaskType:         record.TaskType,
		Tags:             record.Tags,
		Model:            record.Model,
		Status:           record.Status,
		Cost:             record.Cost,
		Remark:           record.Remark,
		SubmittedAt:      record.SubmittedAt,
		CompletedAt:      record.CompletedAt,
		Detail:           taskCenterDetailForRole(record.Detail, includeAdminFields),
		ErrorMessage:     record.ErrorMessage,
		CreatedAt:        record.CreatedAt,
		UpdatedAt:        record.UpdatedAt,
	}
	if includeAdminFields {
		response.RawRequest = record.RawRequest
		response.RawResponse = record.RawResponse
		response.ErrorDetail = record.ErrorDetail
	}
	return response
}

func taskCenterCanStop(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending", "running":
		return true
	default:
		return false
	}
}

func taskStatusCanStop(status model.TaskStatus) bool {
	switch status {
	case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued, model.TaskStatusInProgress:
		return true
	default:
		return false
	}
}

func refundStoppedTaskCenter(c *gin.Context, record *model.TaskCenter, reason string) (int, error) {
	if record == nil || record.Cost <= 0 {
		return 0, nil
	}
	if record.Source == model.TaskCenterSourceTask || record.Source == model.TaskCenterSourceWorkspaceVideo {
		task, exists, err := model.GetByOnlyTaskId(record.TaskID)
		if err != nil {
			return 0, err
		}
		if exists && task != nil {
			before := task.Status
			if !taskStatusCanStop(before) {
				return 0, nil
			}
			task.Status = model.TaskStatusFailure
			task.Progress = "100%"
			task.FinishTime = time.Now().Unix()
			task.FailReason = reason
			updated, err := task.UpdateWithStatus(before)
			if err != nil {
				return 0, err
			}
			if updated {
				service.RefundTaskQuota(context.Background(), task, reason)
				return task.Quota, nil
			}
			return 0, nil
		}
	}
	if err := model.IncreaseUserQuota(record.UserID, record.Cost, false); err != nil {
		return 0, err
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    record.UserID,
		LogType:   model.LogTypeRefund,
		Content:   reason,
		ModelName: record.Model,
		Quota:     record.Cost,
		Other: map[string]interface{}{
			"task_id":        record.TaskID,
			"task_center_id": record.ID,
			"reason":         reason,
			"source":         record.Source,
		},
	})
	return record.Cost, nil
}

func stopTaskCenter(c *gin.Context, id int64) stopTaskCenterResult {
	const reason = "管理员手动停止任务并退款"
	result := stopTaskCenterResult{ID: id}
	if !isTaskCenterAdmin(c) {
		result.Message = "permission denied"
		return result
	}
	currentRecord, err := model.GetTaskCenterByID(id, c.GetInt("id"), true)
	if err != nil {
		result.Message = err.Error()
		return result
	}
	result.TaskID = currentRecord.TaskID
	if !taskCenterCanStop(currentRecord.Status) {
		result.Message = "task is not stoppable"
		return result
	}
	if currentRecord.Source == model.TaskCenterSourceTask || currentRecord.Source == model.TaskCenterSourceWorkspaceVideo {
		task, exists, err := model.GetByOnlyTaskId(currentRecord.TaskID)
		if err != nil {
			result.Message = err.Error()
			return result
		}
		if exists && task != nil && !taskStatusCanStop(task.Status) {
			result.Message = "task is not stoppable"
			return result
		}
	}
	record, stopped, err := model.StopTaskCenterByID(id, c.GetInt("id"), true, reason)
	if err != nil {
		result.Message = err.Error()
		return result
	}
	if record != nil {
		result.TaskID = record.TaskID
	}
	if !stopped {
		if record != nil && !taskCenterCanStop(record.Status) {
			result.Message = "task is not stoppable"
		} else {
			result.Message = "task was not stopped"
		}
		return result
	}
	if record.Source == model.TaskCenterSourceWorkspaceImage {
		CancelRunningWorkspaceImageJob(record.TaskID)
		if err := model.CancelWorkspaceImageJob(record.TaskID, reason); err != nil {
			logger.LogWarn(c, fmt.Sprintf("failed to cancel workspace image job %s: %s", record.TaskID, err.Error()))
		}
	}
	refunded, err := refundStoppedTaskCenter(c, record, reason)
	if err != nil {
		result.Message = "stopped but refund failed: " + err.Error()
		return result
	}
	result.Stopped = true
	result.RefundedQuota = refunded
	result.Message = "stopped"
	return result
}

func GetTaskCenterAsset(c *gin.Context) {
	relativePath := strings.TrimPrefix(c.Param("path"), "/")
	parts := strings.Split(relativePath, "/")
	if len(parts) < 3 || strings.TrimSpace(parts[0]) == "" {
		c.Status(http.StatusNotFound)
		return
	}
	path, ok := model.LocalTaskCenterAssetPath(relativePath)
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	c.File(path)
}

func GetTaskCenter(c *gin.Context) {
	admin := isTaskCenterAdmin(c)
	pageInfo := common.GetPageQuery(c)
	params := parseTaskCenterQuery(c, admin)
	records, total, err := model.ListTaskCenters(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), params)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]taskCenterResponse, 0, len(records))
	for _, record := range records {
		items = append(items, taskCenterToResponse(record, false))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetTaskCenterDetail(c *gin.Context) {
	admin := isTaskCenterAdmin(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid task center id",
		})
		return
	}
	record, err := model.GetTaskCenterByID(id, c.GetInt("id"), admin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.NormalizeTaskCenterDetail(record)
	common.ApiSuccess(c, taskCenterToResponse(record, admin))
}

func StopTaskCenter(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid task center id",
		})
		return
	}
	result := stopTaskCenter(c, id)
	if !result.Stopped {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": result.Message,
			"data":    result,
		})
		return
	}
	common.ApiSuccess(c, result)
}

func BatchStopTaskCenter(c *gin.Context) {
	if !isTaskCenterAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "permission denied",
		})
		return
	}
	var req stopTaskCenterBatchRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}
	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "ids is required",
		})
		return
	}
	if len(req.IDs) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "too many tasks selected",
		})
		return
	}
	results := make([]stopTaskCenterResult, 0, len(req.IDs))
	stoppedCount := 0
	refundedQuota := 0
	seen := map[int64]bool{}
	for _, id := range req.IDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		result := stopTaskCenter(c, id)
		if result.Stopped {
			stoppedCount++
			refundedQuota += result.RefundedQuota
		}
		results = append(results, result)
	}
	common.ApiSuccess(c, gin.H{
		"items":          results,
		"stopped_count":  stoppedCount,
		"refunded_quota": refundedQuota,
	})
}

func UpdateTaskCenterRemark(c *gin.Context) {
	admin := isTaskCenterAdmin(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid task center id",
		})
		return
	}
	var req updateTaskCenterRemarkRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}
	if len(req.Remark) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "remark is too long",
		})
		return
	}
	if err := model.UpdateTaskCenterRemark(id, c.GetInt("id"), admin, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
