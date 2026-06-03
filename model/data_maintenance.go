package model

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	DataMaintenanceTypeImage          = "image"
	DataMaintenanceTypeVideo          = "video"
	DataMaintenanceTypeReferenceImage = "reference_image"
	DataMaintenanceTypeChatMessages   = "chat_messages"
	DataMaintenanceTypeChatFiles      = "chat_files"

	DataMaintenanceOptionAutoCleanupEnabled     = "data_maintenance.auto_cleanup_enabled"
	DataMaintenanceOptionCleanupIntervalHours   = "data_maintenance.cleanup_interval_hours"
	DataMaintenanceOptionImageRetentionDays     = "data_maintenance.image_retention_days"
	DataMaintenanceOptionVideoRetentionDays     = "data_maintenance.video_retention_days"
	DataMaintenanceOptionReferenceRetentionDays = "data_maintenance.reference_image_retention_days"
	DataMaintenanceOptionChatRetentionDays      = "data_maintenance.chat_message_retention_days"
	DataMaintenanceOptionChatFileRetentionDays  = "data_maintenance.chat_file_retention_days"
	DataMaintenanceOptionLastCleanupTime        = "data_maintenance.last_cleanup_time"
	DataMaintenanceOptionLastCleanupSummary     = "data_maintenance.last_cleanup_summary"
)

type DataMaintenanceLog struct {
	ID             int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt      int64  `json:"updated_at" gorm:"autoUpdateTime"`
	OperatorID     int    `json:"operator_id" gorm:"index"`
	OperatorName   string `json:"operator_name" gorm:"type:varchar(191);default:''"`
	CleanupTypes   string `json:"cleanup_types" gorm:"type:varchar(255);index"`
	StartTime      int64  `json:"start_time" gorm:"index"`
	EndTime        int64  `json:"end_time" gorm:"index"`
	BeforeTime     int64  `json:"before_time" gorm:"index"`
	DryRun         bool   `json:"dry_run" gorm:"default:false"`
	DeletedFiles   int    `json:"deleted_files"`
	DeletedRecords int    `json:"deleted_records"`
	FailedCount    int    `json:"failed_count"`
	ErrorDetail    string `json:"error_detail" gorm:"type:text"`
	StartedAt      int64  `json:"started_at" gorm:"index"`
	FinishedAt     int64  `json:"finished_at" gorm:"index"`
}

type DataMaintenanceSettings struct {
	AutoCleanupEnabled     bool   `json:"auto_cleanup_enabled"`
	CleanupIntervalHours   int    `json:"cleanup_interval_hours"`
	ImageRetentionDays     int    `json:"image_retention_days"`
	VideoRetentionDays     int    `json:"video_retention_days"`
	ReferenceRetentionDays int    `json:"reference_image_retention_days"`
	ChatRetentionDays      int    `json:"chat_message_retention_days"`
	ChatFileRetentionDays  int    `json:"chat_file_retention_days"`
	LastCleanupTime        int64  `json:"last_cleanup_time"`
	LastCleanupSummary     string `json:"last_cleanup_summary"`
}

type DataMaintenanceCleanupRequest struct {
	Types        []string `json:"types"`
	StartTime    int64    `json:"start_time"`
	EndTime      int64    `json:"end_time"`
	BeforeTime   int64    `json:"before_time"`
	DryRun       bool     `json:"dry_run"`
	OperatorID   int      `json:"operator_id"`
	OperatorName string   `json:"operator_name"`
}

type DataMaintenanceCleanupResult struct {
	Types          []string `json:"types"`
	StartTime      int64    `json:"start_time"`
	EndTime        int64    `json:"end_time"`
	BeforeTime     int64    `json:"before_time"`
	DryRun         bool     `json:"dry_run"`
	DeletedFiles   int      `json:"deleted_files"`
	DeletedRecords int      `json:"deleted_records"`
	FailedCount    int      `json:"failed_count"`
	FailedItems    []string `json:"failed_items"`
	StartedAt      int64    `json:"started_at"`
	FinishedAt     int64    `json:"finished_at"`
}

func GetDataMaintenanceSettings() DataMaintenanceSettings {
	return DataMaintenanceSettings{
		AutoCleanupEnabled:     getOptionBool(DataMaintenanceOptionAutoCleanupEnabled, false),
		CleanupIntervalHours:   getOptionInt(DataMaintenanceOptionCleanupIntervalHours, 24),
		ImageRetentionDays:     getOptionInt(DataMaintenanceOptionImageRetentionDays, 0),
		VideoRetentionDays:     getOptionInt(DataMaintenanceOptionVideoRetentionDays, 0),
		ReferenceRetentionDays: getOptionInt(DataMaintenanceOptionReferenceRetentionDays, 0),
		ChatRetentionDays:      getOptionInt(DataMaintenanceOptionChatRetentionDays, 0),
		ChatFileRetentionDays:  getOptionInt(DataMaintenanceOptionChatFileRetentionDays, 0),
		LastCleanupTime:        int64(getOptionInt(DataMaintenanceOptionLastCleanupTime, 0)),
		LastCleanupSummary:     getOptionString(DataMaintenanceOptionLastCleanupSummary, ""),
	}
}

func SaveDataMaintenanceSettings(settings DataMaintenanceSettings) error {
	values := map[string]string{
		DataMaintenanceOptionAutoCleanupEnabled:     boolString(settings.AutoCleanupEnabled),
		DataMaintenanceOptionCleanupIntervalHours:   intString(minPositive(settings.CleanupIntervalHours, 24)),
		DataMaintenanceOptionImageRetentionDays:     intString(nonNegative(settings.ImageRetentionDays)),
		DataMaintenanceOptionVideoRetentionDays:     intString(nonNegative(settings.VideoRetentionDays)),
		DataMaintenanceOptionReferenceRetentionDays: intString(nonNegative(settings.ReferenceRetentionDays)),
		DataMaintenanceOptionChatRetentionDays:      intString(nonNegative(settings.ChatRetentionDays)),
		DataMaintenanceOptionChatFileRetentionDays:  intString(nonNegative(settings.ChatFileRetentionDays)),
	}
	return UpdateOptionsBulk(values)
}

func ListDataMaintenanceLogs(limit int) ([]DataMaintenanceLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var logs []DataMaintenanceLog
	err := DB.Order("id DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

func RunDataMaintenanceCleanup(req DataMaintenanceCleanupRequest) (DataMaintenanceCleanupResult, error) {
	req.Types = normalizeMaintenanceTypes(req.Types)
	if len(req.Types) == 0 {
		return DataMaintenanceCleanupResult{}, errors.New("cleanup type is required")
	}
	startTime, endTime, beforeTime, err := normalizeCleanupTimeRange(req)
	if err != nil {
		return DataMaintenanceCleanupResult{}, err
	}
	result := DataMaintenanceCleanupResult{
		Types:      req.Types,
		StartTime:  startTime,
		EndTime:    endTime,
		BeforeTime: beforeTime,
		DryRun:     req.DryRun,
		StartedAt:  time.Now().Unix(),
	}
	chatCleaned := false
	for _, cleanupType := range req.Types {
		switch cleanupType {
		case DataMaintenanceTypeImage:
			applyTaskCenterAssetCleanup(&result, startTime, endTime, req.DryRun, DataMaintenanceTypeImage)
		case DataMaintenanceTypeVideo:
			applyTaskCenterAssetCleanup(&result, startTime, endTime, req.DryRun, DataMaintenanceTypeVideo)
		case DataMaintenanceTypeReferenceImage:
			applyTaskCenterAssetCleanup(&result, startTime, endTime, req.DryRun, DataMaintenanceTypeReferenceImage)
		case DataMaintenanceTypeChatMessages, DataMaintenanceTypeChatFiles:
			if chatCleaned {
				continue
			}
			applyWorkspaceChatCleanup(&result, startTime, endTime, req.DryRun)
			chatCleaned = true
		}
	}
	result.FinishedAt = time.Now().Unix()
	log := DataMaintenanceLog{
		OperatorID:     req.OperatorID,
		OperatorName:   req.OperatorName,
		CleanupTypes:   strings.Join(result.Types, ","),
		StartTime:      result.StartTime,
		EndTime:        result.EndTime,
		BeforeTime:     result.BeforeTime,
		DryRun:         result.DryRun,
		DeletedFiles:   result.DeletedFiles,
		DeletedRecords: result.DeletedRecords,
		FailedCount:    result.FailedCount,
		ErrorDetail:    strings.Join(result.FailedItems, "\n"),
		StartedAt:      result.StartedAt,
		FinishedAt:     result.FinishedAt,
	}
	_ = DB.Create(&log).Error
	if !req.DryRun {
		summary, _ := common.Marshal(result)
		_ = UpdateOptionsBulk(map[string]string{
			DataMaintenanceOptionLastCleanupTime:    intString(int(result.FinishedAt)),
			DataMaintenanceOptionLastCleanupSummary: string(summary),
		})
	}
	return result, nil
}

func normalizeCleanupTimeRange(req DataMaintenanceCleanupRequest) (int64, int64, int64, error) {
	startTime := req.StartTime
	endTime := req.EndTime
	beforeTime := req.BeforeTime
	if endTime <= 0 && beforeTime > 0 {
		endTime = beforeTime
	}
	if beforeTime <= 0 {
		beforeTime = endTime
	}
	if endTime <= 0 {
		return 0, 0, 0, errors.New("end_time is required")
	}
	if startTime < 0 {
		startTime = 0
	}
	if startTime > endTime {
		return 0, 0, 0, errors.New("start_time cannot be later than end_time")
	}
	return startTime, endTime, beforeTime, nil
}

func RunAutomaticDataMaintenanceCleanup() {
	settings := GetDataMaintenanceSettings()
	if !settings.AutoCleanupEnabled {
		return
	}
	type retention struct {
		cleanupType string
		days        int
	}
	for _, item := range []retention{
		{DataMaintenanceTypeImage, settings.ImageRetentionDays},
		{DataMaintenanceTypeVideo, settings.VideoRetentionDays},
		{DataMaintenanceTypeReferenceImage, settings.ReferenceRetentionDays},
		{DataMaintenanceTypeChatMessages, settings.ChatRetentionDays},
		{DataMaintenanceTypeChatFiles, settings.ChatFileRetentionDays},
	} {
		if item.days <= 0 {
			continue
		}
		_, err := RunDataMaintenanceCleanup(DataMaintenanceCleanupRequest{
			Types:        []string{item.cleanupType},
			BeforeTime:   time.Now().AddDate(0, 0, -item.days).Unix(),
			OperatorName: "system",
		})
		if err != nil {
			common.SysLog("data maintenance cleanup failed: " + err.Error())
		}
	}
}

func applyTaskCenterAssetCleanup(result *DataMaintenanceCleanupResult, startTime int64, endTime int64, dryRun bool, cleanupType string) {
	var records []TaskCenter
	query := DB.Where(
		"(completed_at > ? AND completed_at >= ? AND completed_at <= ?) OR (completed_at = ? AND submitted_at >= ? AND submitted_at <= ?)",
		0,
		startTime,
		endTime,
		0,
		startTime,
		endTime,
	)
	if cleanupType == DataMaintenanceTypeImage {
		query = query.Where("task_type = ?", TaskCenterTypeImage)
	}
	if cleanupType == DataMaintenanceTypeVideo {
		query = query.Where("task_type = ?", TaskCenterTypeVideo)
	}
	if err := query.Find(&records).Error; err != nil {
		result.FailedCount++
		result.FailedItems = append(result.FailedItems, err.Error())
		return
	}
	for _, record := range records {
		detail := parseTaskCenterDetail(record.Detail)
		before := marshalTaskCenterDetail(detail)
		switch cleanupType {
		case DataMaintenanceTypeImage:
			detail.Images = cleanupTaskCenterURLList(result, detail.Images, &detail.ExpiredImages, dryRun)
		case DataMaintenanceTypeVideo:
			detail.Videos = cleanupTaskCenterURLList(result, detail.Videos, &detail.ExpiredVideos, dryRun)
		case DataMaintenanceTypeReferenceImage:
			detail.ReferenceImages = cleanupTaskCenterURLList(result, detail.ReferenceImages, &detail.ExpiredReferences, dryRun)
		}
		after := marshalTaskCenterDetail(detail)
		if !dryRun && after != before {
			if err := DB.Model(&TaskCenter{}).Where("id = ?", record.ID).Updates(map[string]any{
				"detail":     after,
				"updated_at": time.Now().Unix(),
			}).Error; err != nil {
				result.FailedCount++
				result.FailedItems = append(result.FailedItems, err.Error())
			}
		}
	}
}

func cleanupTaskCenterURLList(result *DataMaintenanceCleanupResult, urls []string, expired *[]string, dryRun bool) []string {
	nextExpired := map[string]bool{}
	for _, value := range *expired {
		nextExpired[value] = true
	}
	for _, value := range urls {
		value = strings.TrimSpace(value)
		if value == "" || !strings.HasPrefix(value, TaskCenterAssetURLPrefix+"/") || nextExpired[value] {
			continue
		}
		if dryRun {
			result.DeletedFiles++
			nextExpired[value] = true
			continue
		}
		if err := deleteTaskCenterAssetURL(value); err != nil {
			result.FailedCount++
			result.FailedItems = append(result.FailedItems, value+": "+err.Error())
			continue
		}
		result.DeletedFiles++
		nextExpired[value] = true
	}
	merged := make([]string, 0, len(nextExpired))
	for value := range nextExpired {
		merged = append(merged, value)
	}
	*expired = uniqueStrings(merged)
	return urls
}

func deleteTaskCenterAssetURL(value string) error {
	relative := strings.TrimPrefix(value, TaskCenterAssetURLPrefix+"/")
	relative, err := urlPathUnescape(relative)
	if err != nil {
		return err
	}
	target, ok := LocalTaskCenterAssetPath(relative)
	if !ok {
		return errors.New("invalid asset path")
	}
	err = os.Remove(target)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	root, err := filepath.Abs(taskCenterAssetRoot)
	if err == nil {
		_ = removeEmptyParents(filepath.Dir(target), root)
	}
	return nil
}

func applyWorkspaceChatCleanup(result *DataMaintenanceCleanupResult, startTime int64, endTime int64, dryRun bool) {
	var count int64
	if err := DB.Model(&WorkspaceChatMessage{}).
		Where("created_time >= ? AND created_time <= ? AND (content <> ? OR metadata <> ?)", startTime, endTime, "", "{}").
		Count(&count).Error; err != nil {
		result.FailedCount++
		result.FailedItems = append(result.FailedItems, err.Error())
		return
	}
	result.DeletedRecords += int(count)
	if dryRun || count == 0 {
		return
	}
	if err := DB.Model(&WorkspaceChatMessage{}).
		Where("created_time >= ? AND created_time <= ? AND (content <> ? OR metadata <> ?)", startTime, endTime, "", "{}").
		Updates(map[string]any{
			"content":      "",
			"metadata":     "{}",
			"updated_time": time.Now().Unix(),
		}).Error; err != nil {
		result.FailedCount++
		result.FailedItems = append(result.FailedItems, err.Error())
	}
}

func normalizeMaintenanceTypes(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	allowed := map[string]bool{
		DataMaintenanceTypeImage:          true,
		DataMaintenanceTypeVideo:          true,
		DataMaintenanceTypeReferenceImage: true,
		DataMaintenanceTypeChatMessages:   true,
		DataMaintenanceTypeChatFiles:      true,
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "all" {
			return []string{
				DataMaintenanceTypeImage,
				DataMaintenanceTypeVideo,
				DataMaintenanceTypeReferenceImage,
				DataMaintenanceTypeChatMessages,
				DataMaintenanceTypeChatFiles,
			}
		}
		if allowed[value] && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func getOptionString(key string, fallback string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if value, ok := common.OptionMap[key]; ok {
		return value
	}
	return fallback
}

func getOptionInt(key string, fallback int) int {
	value, err := strconv.Atoi(getOptionString(key, ""))
	if err != nil {
		return fallback
	}
	return value
}

func getOptionBool(key string, fallback bool) bool {
	value := getOptionString(key, "")
	if value == "" {
		return fallback
	}
	return value == "true"
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func nonNegative(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func minPositive(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func urlPathUnescape(value string) (string, error) {
	parts := strings.Split(value, "/")
	for index, part := range parts {
		unescaped, err := url.PathUnescape(part)
		if err != nil {
			return "", err
		}
		parts[index] = unescaped
	}
	return strings.Join(parts, "/"), nil
}

func removeEmptyParents(dir string, root string) error {
	for {
		rel, err := filepath.Rel(root, dir)
		if err != nil || rel == "." || strings.HasPrefix(rel, "..") {
			return nil
		}
		if err := os.Remove(dir); err != nil {
			return nil
		}
		dir = filepath.Dir(dir)
	}
}
