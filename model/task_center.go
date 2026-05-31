package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

const (
	TaskCenterSourceTask       = "task"
	TaskCenterSourceMidjourney = "midjourney"

	TaskCenterTypeImage = "image"
	TaskCenterTypeVideo = "video"
	TaskCenterTypeAudio = "audio"
	TaskCenterTypeOther = "other"
)

type TaskCenter struct {
	ID               int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt        int64          `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt        int64          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`
	Source           string         `json:"source" gorm:"type:varchar(32);index"`
	SourceID         string         `json:"source_id" gorm:"type:varchar(191);index"`
	TaskID           string         `json:"task_id" gorm:"type:varchar(191);uniqueIndex"`
	UserID           int            `json:"user_id" gorm:"index"`
	UsernameSnapshot string         `json:"username_snapshot" gorm:"type:varchar(191);index"`
	TaskType         string         `json:"task_type" gorm:"type:varchar(32);index"`
	Tags             string         `json:"tags" gorm:"type:text"`
	Model            string         `json:"model" gorm:"type:varchar(191);index"`
	Status           string         `json:"status" gorm:"type:varchar(32);index"`
	Cost             int            `json:"cost" gorm:"column:cost"`
	Remark           string         `json:"remark" gorm:"type:text"`
	SubmittedAt      int64          `json:"submitted_at" gorm:"index"`
	CompletedAt      int64          `json:"completed_at" gorm:"index"`
	Detail           string         `json:"detail" gorm:"type:text"`
	RawRequest       string         `json:"raw_request,omitempty" gorm:"type:text"`
	RawResponse      string         `json:"raw_response,omitempty" gorm:"type:text"`
	ErrorMessage     string         `json:"error_message" gorm:"type:text"`
	ErrorDetail      string         `json:"error_detail,omitempty" gorm:"type:text"`
}

type TaskCenterQueryParams struct {
	Keyword        string
	TaskType       string
	Status         string
	Model          string
	User           string
	Tag            string
	SubmittedStart int64
	SubmittedEnd   int64
	UserID         int
	Admin          bool
}

type TaskCenterDetail struct {
	Prompt          string         `json:"prompt,omitempty"`
	NegativePrompt  string         `json:"negative_prompt,omitempty"`
	InputText       string         `json:"input_text,omitempty"`
	OutputText      string         `json:"output_text,omitempty"`
	Images          []string       `json:"images,omitempty"`
	Videos          []string       `json:"videos,omitempty"`
	Audios          []string       `json:"audios,omitempty"`
	Files           []string       `json:"files,omitempty"`
	ReferenceImages []string       `json:"reference_images,omitempty"`
	Size            string         `json:"size,omitempty"`
	Ratio           string         `json:"ratio,omitempty"`
	Style           string         `json:"style,omitempty"`
	Quality         string         `json:"quality,omitempty"`
	Duration        string         `json:"duration,omitempty"`
	Provider        string         `json:"provider,omitempty"`
	Metadata        map[string]any `json:"metadata,omitempty"`
}

func tagsToString(tags []string) string {
	clean := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, tag := range tags {
		tag = strings.TrimSpace(strings.ToLower(tag))
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		clean = append(clean, tag)
	}
	b, err := common.Marshal(clean)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func usernameSnapshot(userID int) string {
	if userID == 0 {
		return ""
	}
	user, err := GetUserCache(userID)
	if err == nil && user != nil {
		return user.Username
	}
	return ""
}

func normalizeTaskCenterStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "SUCCESS", "SUCCEEDED", "COMPLETED", "FINISH":
		return "succeeded"
	case "FAILURE", "FAILED", "ERROR":
		return "failed"
	case "QUEUED", "SUBMITTED", "NOT_START":
		return "pending"
	case "IN_PROGRESS", "RUNNING", "PROCESSING":
		return "running"
	case "CANCELLED", "CANCELED":
		return "cancelled"
	default:
		if status == "" {
			return "pending"
		}
		return strings.ToLower(status)
	}
}

func inferTaskCenterTypeFromTask(task *Task) string {
	action := strings.ToLower(task.Action)
	modelName := strings.ToLower(task.Properties.OriginModelName + " " + task.Properties.UpstreamModelName)
	switch {
	case strings.Contains(action, "song") || strings.Contains(action, "audio") || strings.Contains(modelName, "suno"):
		return TaskCenterTypeAudio
	case strings.Contains(action, "image"):
		return TaskCenterTypeImage
	case strings.Contains(action, "video") || task.Platform != constant.TaskPlatformSuno:
		return TaskCenterTypeVideo
	default:
		return TaskCenterTypeOther
	}
}

func buildTaskCenterDetailFromTask(task *Task) string {
	detail := TaskCenterDetail{
		Provider: string(task.Platform),
		Metadata: map[string]any{
			"action":      task.Action,
			"progress":    task.Progress,
			"result_url":  task.GetResultURL(),
			"properties":  task.Properties,
			"source":      TaskCenterSourceTask,
			"source_id":   task.ID,
			"channel_id":  task.ChannelId,
			"submit_time": task.SubmitTime,
		},
	}
	if task.Properties.Input != "" {
		detail.Prompt = task.Properties.Input
	}
	if resultURL := strings.TrimSpace(task.GetResultURL()); resultURL != "" {
		if inferTaskCenterTypeFromTask(task) == TaskCenterTypeVideo {
			detail.Videos = []string{resultURL}
		} else {
			detail.Files = []string{resultURL}
		}
	}
	var data map[string]any
	if len(task.Data) > 0 && common.Unmarshal(task.Data, &data) == nil {
		if prompt, ok := data["prompt"].(string); ok && detail.Prompt == "" {
			detail.Prompt = prompt
		}
		if model, ok := data["model"].(string); ok && model != "" {
			detail.Metadata["model"] = model
		}
		if size, ok := data["size"].(string); ok {
			detail.Size = size
		}
		if seconds, ok := data["seconds"].(string); ok {
			detail.Duration = seconds
		}
		if url, ok := data["url"].(string); ok && url != "" {
			detail.Videos = append(detail.Videos, url)
		}
	}
	b, err := common.Marshal(detail)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func BuildTaskCenterFromTask(task *Task) *TaskCenter {
	taskType := inferTaskCenterTypeFromTask(task)
	modelName := task.Properties.OriginModelName
	if modelName == "" {
		modelName = task.Properties.UpstreamModelName
	}
	if modelName == "" && len(task.Data) > 0 {
		var data map[string]any
		if common.Unmarshal(task.Data, &data) == nil {
			if m, ok := data["model"].(string); ok {
				modelName = m
			}
		}
	}
	tags := []string{"task", taskType, string(task.Platform), task.Action, normalizeTaskCenterStatus(string(task.Status))}
	rawResponse := ""
	if len(task.Data) > 0 {
		rawResponse = string(task.Data)
	}
	return &TaskCenter{
		Source:           TaskCenterSourceTask,
		SourceID:         fmt.Sprintf("%d", task.ID),
		TaskID:           task.TaskID,
		UserID:           task.UserId,
		UsernameSnapshot: usernameSnapshot(task.UserId),
		TaskType:         taskType,
		Tags:             tagsToString(tags),
		Model:            modelName,
		Status:           normalizeTaskCenterStatus(string(task.Status)),
		Cost:             task.Quota,
		SubmittedAt:      task.SubmitTime,
		CompletedAt:      task.FinishTime,
		Detail:           buildTaskCenterDetailFromTask(task),
		RawResponse:      rawResponse,
		ErrorMessage:     task.FailReason,
		ErrorDetail:      task.FailReason,
	}
}

func buildTaskCenterDetailFromMidjourney(task *Midjourney) string {
	detail := TaskCenterDetail{
		Prompt:   task.Prompt,
		Images:   []string{},
		Videos:   []string{},
		Provider: "midjourney",
		Metadata: map[string]any{
			"action":      task.Action,
			"prompt_en":   task.PromptEn,
			"description": task.Description,
			"state":       task.State,
			"progress":    task.Progress,
			"buttons":     task.Buttons,
			"properties":  task.Properties,
			"source":      TaskCenterSourceMidjourney,
			"source_id":   task.Id,
			"channel_id":  task.ChannelId,
		},
	}
	if task.ImageUrl != "" {
		detail.Images = append(detail.Images, task.ImageUrl)
	}
	if task.VideoUrl != "" {
		detail.Videos = append(detail.Videos, task.VideoUrl)
	}
	if task.VideoUrls != "" {
		var urls []string
		if common.UnmarshalJsonStr(task.VideoUrls, &urls) == nil {
			detail.Videos = append(detail.Videos, urls...)
		}
	}
	b, err := common.Marshal(detail)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func BuildTaskCenterFromMidjourney(task *Midjourney) *TaskCenter {
	taskType := TaskCenterTypeImage
	if task.VideoUrl != "" || task.VideoUrls != "" || strings.Contains(strings.ToLower(task.Action), "video") {
		taskType = TaskCenterTypeVideo
	}
	tags := []string{"drawing", "midjourney", taskType, task.Action, normalizeTaskCenterStatus(task.Status)}
	raw := map[string]any{
		"prompt":      task.Prompt,
		"prompt_en":   task.PromptEn,
		"description": task.Description,
		"properties":  task.Properties,
		"buttons":     task.Buttons,
	}
	rawResponseBytes, _ := common.Marshal(raw)
	return &TaskCenter{
		Source:           TaskCenterSourceMidjourney,
		SourceID:         fmt.Sprintf("%d", task.Id),
		TaskID:           task.MjId,
		UserID:           task.UserId,
		UsernameSnapshot: usernameSnapshot(task.UserId),
		TaskType:         taskType,
		Tags:             tagsToString(tags),
		Model:            "midjourney",
		Status:           normalizeTaskCenterStatus(task.Status),
		Cost:             task.Quota,
		SubmittedAt:      task.SubmitTime / 1000,
		CompletedAt:      task.FinishTime / 1000,
		Detail:           buildTaskCenterDetailFromMidjourney(task),
		RawResponse:      string(rawResponseBytes),
		ErrorMessage:     task.FailReason,
		ErrorDetail:      task.FailReason,
	}
}

func UpsertTaskCenter(record *TaskCenter) error {
	if record == nil || record.TaskID == "" {
		return nil
	}
	now := time.Now().Unix()
	var existing TaskCenter
	err := DB.Where("task_id = ?", record.TaskID).First(&existing).Error
	if err == nil {
		existingID := existing.ID
		remark := existing.Remark
		rawRequest := existing.RawRequest
		existing = *record
		existing.ID = existingID
		existing.Remark = remark
		if rawRequest != "" && existing.RawRequest == "" {
			existing.RawRequest = rawRequest
		}
		existing.UpdatedAt = now
		return DB.Model(&TaskCenter{}).Where("id = ?", existing.ID).Updates(map[string]any{
			"source":            existing.Source,
			"source_id":         existing.SourceID,
			"user_id":           existing.UserID,
			"username_snapshot": existing.UsernameSnapshot,
			"task_type":         existing.TaskType,
			"tags":              existing.Tags,
			"model":             existing.Model,
			"status":            existing.Status,
			"cost":              existing.Cost,
			"submitted_at":      existing.SubmittedAt,
			"completed_at":      existing.CompletedAt,
			"detail":            existing.Detail,
			"raw_request":       existing.RawRequest,
			"raw_response":      existing.RawResponse,
			"error_message":     existing.ErrorMessage,
			"error_detail":      existing.ErrorDetail,
			"updated_at":        existing.UpdatedAt,
		}).Error
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	record.CreatedAt = now
	record.UpdatedAt = now
	return DB.Create(record).Error
}

func SyncTaskCenterFromTask(task *Task) error {
	return UpsertTaskCenter(BuildTaskCenterFromTask(task))
}

func SyncTaskCenterFromMidjourney(task *Midjourney) error {
	return UpsertTaskCenter(BuildTaskCenterFromMidjourney(task))
}

func UpdateTaskCenterRawRequest(taskID string, rawRequest any) error {
	if taskID == "" || rawRequest == nil {
		return nil
	}
	b, err := common.Marshal(rawRequest)
	if err != nil {
		return err
	}
	return DB.Model(&TaskCenter{}).Where("task_id = ?", taskID).Update("raw_request", string(b)).Error
}

func ListTaskCenters(startIdx int, pageSize int, params TaskCenterQueryParams) ([]*TaskCenter, int64, error) {
	var records []*TaskCenter
	query := buildTaskCenterQuery(params)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("submitted_at desc, id desc").Limit(pageSize).Offset(startIdx).Find(&records).Error
	return records, total, err
}

func buildTaskCenterQuery(params TaskCenterQueryParams) *gorm.DB {
	query := DB.Model(&TaskCenter{})
	if !params.Admin {
		query = query.Where("user_id = ?", params.UserID)
	} else if params.User != "" {
		like := "%" + params.User + "%"
		if userID, err := strconv.Atoi(params.User); err == nil {
			query = query.Where("(username_snapshot LIKE ? OR user_id = ?)", like, userID)
		} else {
			query = query.Where("username_snapshot LIKE ?", like)
		}
	}
	if params.Keyword != "" {
		like := "%" + params.Keyword + "%"
		query = query.Where("task_id LIKE ? OR username_snapshot LIKE ? OR model LIKE ? OR remark LIKE ? OR detail LIKE ?", like, like, like, like, like)
	}
	if params.TaskType != "" {
		query = query.Where("task_type = ?", params.TaskType)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.Model != "" {
		query = query.Where("model LIKE ?", "%"+params.Model+"%")
	}
	if params.Tag != "" {
		query = query.Where("tags LIKE ?", "%"+strings.ToLower(params.Tag)+"%")
	}
	if params.SubmittedStart > 0 {
		query = query.Where("submitted_at >= ?", params.SubmittedStart)
	}
	if params.SubmittedEnd > 0 {
		query = query.Where("submitted_at <= ?", params.SubmittedEnd)
	}
	return query
}

func GetTaskCenterByID(id int64, userID int, admin bool) (*TaskCenter, error) {
	var record TaskCenter
	query := DB.Where("id = ?", id)
	if !admin {
		query = query.Where("user_id = ?", userID)
	}
	err := query.First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func UpdateTaskCenterRemark(id int64, userID int, admin bool, remark string) error {
	query := DB.Model(&TaskCenter{}).Where("id = ?", id)
	if !admin {
		query = query.Where("user_id = ?", userID)
	}
	return query.Updates(map[string]any{
		"remark":     remark,
		"updated_at": time.Now().Unix(),
	}).Error
}

func BackfillTaskCenters(limit int) {
	if limit <= 0 {
		limit = 500
	}
	var tasks []*Task
	if err := DB.Order("id desc").Limit(limit).Find(&tasks).Error; err == nil {
		for _, task := range tasks {
			_ = SyncTaskCenterFromTask(task)
		}
	}
	var mjTasks []*Midjourney
	if err := DB.Order("id desc").Limit(limit).Find(&mjTasks).Error; err == nil {
		for _, task := range mjTasks {
			_ = SyncTaskCenterFromMidjourney(task)
		}
	}
}
