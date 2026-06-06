package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	WorkspaceImageJobStatusPending   = "pending"
	WorkspaceImageJobStatusRunning   = "running"
	WorkspaceImageJobStatusSucceeded = "succeeded"
	WorkspaceImageJobStatusFailed    = "failed"
	WorkspaceImageJobStatusCancelled = "cancelled"
)

type WorkspaceImageJob struct {
	ID          int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID      string         `json:"task_id" gorm:"type:varchar(191);uniqueIndex;not null"`
	UserID      int            `json:"user_id" gorm:"index;not null"`
	UserGroup   string         `json:"user_group" gorm:"type:varchar(64);not null"`
	RequestBody string         `json:"request_body" gorm:"type:text;not null"`
	RawRequest  string         `json:"raw_request" gorm:"type:text"`
	ExtraFields string         `json:"extra_fields" gorm:"type:text"`
	Status      string         `json:"status" gorm:"type:varchar(32);index;not null;default:'pending'"`
	Attempts    int            `json:"attempts" gorm:"default:0"`
	SubmittedAt int64          `json:"submitted_at" gorm:"index"`
	StartedAt   int64          `json:"started_at" gorm:"index"`
	FinishedAt  int64          `json:"finished_at" gorm:"index"`
	LastError   string         `json:"last_error" gorm:"type:text"`
	CreatedTime int64          `json:"created_time" gorm:"bigint;index"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint;index"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func CreateWorkspaceImageJob(job *WorkspaceImageJob) error {
	if job == nil {
		return errors.New("workspace image job is nil")
	}
	job.TaskID = strings.TrimSpace(job.TaskID)
	job.UserGroup = strings.TrimSpace(job.UserGroup)
	if job.TaskID == "" {
		return errors.New("task_id is required")
	}
	if job.UserID <= 0 {
		return errors.New("user_id is required")
	}
	if job.UserGroup == "" {
		return errors.New("user_group is required")
	}
	now := common.GetTimestamp()
	if job.SubmittedAt == 0 {
		job.SubmittedAt = now
	}
	job.Status = WorkspaceImageJobStatusPending
	job.CreatedTime = now
	job.UpdatedTime = now
	return DB.Create(job).Error
}

func ListRunnableWorkspaceImageJobs(limit int, staleRunningBefore int64) ([]WorkspaceImageJob, error) {
	if limit <= 0 {
		limit = 10
	}
	var jobs []WorkspaceImageJob
	err := DB.Where("status = ? OR (status = ? AND updated_time < ?)",
		WorkspaceImageJobStatusPending,
		WorkspaceImageJobStatusRunning,
		staleRunningBefore,
	).Order("id asc").Limit(limit).Find(&jobs).Error
	return jobs, err
}

func ClaimWorkspaceImageJob(taskID string, staleRunningBefore int64) (bool, error) {
	now := common.GetTimestamp()
	tx := DB.Model(&WorkspaceImageJob{}).
		Where("task_id = ? AND (status = ? OR (status = ? AND updated_time < ?))",
			taskID,
			WorkspaceImageJobStatusPending,
			WorkspaceImageJobStatusRunning,
			staleRunningBefore,
		).
		Updates(map[string]any{
			"status":       WorkspaceImageJobStatusRunning,
			"attempts":     gorm.Expr("attempts + ?", 1),
			"started_at":   now,
			"updated_time": now,
			"last_error":   "",
		})
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected > 0, nil
}

func FinishWorkspaceImageJob(taskID string, status string, lastError string) error {
	status = strings.TrimSpace(status)
	if status == "" {
		status = WorkspaceImageJobStatusSucceeded
	}
	now := common.GetTimestamp()
	return DB.Model(&WorkspaceImageJob{}).
		Where("task_id = ?", taskID).
		Updates(map[string]any{
			"status":       status,
			"finished_at":  now,
			"updated_time": now,
			"last_error":   lastError,
		}).Error
}

func CancelWorkspaceImageJob(taskID string, reason string) error {
	now := common.GetTimestamp()
	return DB.Model(&WorkspaceImageJob{}).
		Where("task_id = ? AND status IN ?", taskID, []string{WorkspaceImageJobStatusPending, WorkspaceImageJobStatusRunning}).
		Updates(map[string]any{
			"status":       WorkspaceImageJobStatusCancelled,
			"finished_at":  now,
			"updated_time": now,
			"last_error":   reason,
		}).Error
}

func TouchWorkspaceImageJob(taskID string) error {
	now := common.GetTimestamp()
	return DB.Model(&WorkspaceImageJob{}).
		Where("task_id = ? AND status = ?", taskID, WorkspaceImageJobStatusRunning).
		Update("updated_time", now).Error
}
