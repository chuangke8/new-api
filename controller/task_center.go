package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type taskCenterResponse struct {
	ID               int64  `json:"id"`
	Source           string `json:"source"`
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

func taskCenterToResponse(record *model.TaskCenter, includeAdminFields bool) taskCenterResponse {
	response := taskCenterResponse{
		ID:               record.ID,
		Source:           record.Source,
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
		Detail:           record.Detail,
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
	common.ApiSuccess(c, taskCenterToResponse(record, admin))
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
