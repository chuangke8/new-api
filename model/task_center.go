package model

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"gorm.io/gorm"
)

const (
	TaskCenterSourceTask           = "task"
	TaskCenterSourceMidjourney     = "midjourney"
	TaskCenterSourceWorkspaceImage = "workspace_image"
	TaskCenterSourceWorkspaceVideo = "workspace_video"
	TaskCenterSourceAPIImage       = "api_image"

	TaskCenterTypeImage = "image"
	TaskCenterTypeVideo = "video"
	TaskCenterTypeAudio = "audio"
	TaskCenterTypeOther = "other"

	TaskCenterSubmitSourceAPI       = "api"
	TaskCenterSubmitSourceWorkspace = "workspace"
	TaskCenterSubmitSourceSystem    = "system"
)

const (
	taskCenterAssetRoot       = "data/task-center"
	TaskCenterAssetURLPrefix  = "/api/task-center-assets"
	taskCenterAssetMaxBytes   = 512 * 1024 * 1024
	taskCenterAssetTimeout    = 3 * time.Minute
	taskCenterAssetHTTPClient = "new-api-task-center-assets"
)

type TaskCenter struct {
	ID               int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt        int64          `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt        int64          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`
	Source           string         `json:"source" gorm:"type:varchar(32);index"`
	SubmitSource     string         `json:"submit_source" gorm:"type:varchar(32);index;default:'api'"`
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
	SubmitSource   string
	SubmittedStart int64
	SubmittedEnd   int64
	UserID         int
	Admin          bool
}

type TaskCenterDetail struct {
	Prompt            string         `json:"prompt,omitempty"`
	NegativePrompt    string         `json:"negative_prompt,omitempty"`
	InputText         string         `json:"input_text,omitempty"`
	OutputText        string         `json:"output_text,omitempty"`
	Images            []string       `json:"images,omitempty"`
	Videos            []string       `json:"videos,omitempty"`
	Audios            []string       `json:"audios,omitempty"`
	Files             []string       `json:"files,omitempty"`
	ReferenceImages   []string       `json:"reference_images,omitempty"`
	ExpiredImages     []string       `json:"expired_images,omitempty"`
	ExpiredVideos     []string       `json:"expired_videos,omitempty"`
	ExpiredFiles      []string       `json:"expired_files,omitempty"`
	ExpiredReferences []string       `json:"expired_reference_images,omitempty"`
	Size              string         `json:"size,omitempty"`
	Ratio             string         `json:"ratio,omitempty"`
	Style             string         `json:"style,omitempty"`
	Quality           string         `json:"quality,omitempty"`
	Duration          string         `json:"duration,omitempty"`
	Provider          string         `json:"provider,omitempty"`
	Metadata          map[string]any `json:"metadata,omitempty"`
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func normalizeTaskCenterDetail(detail TaskCenterDetail) TaskCenterDetail {
	detail.Images = uniqueStrings(detail.Images)
	detail.Videos = uniqueStrings(detail.Videos)
	detail.Audios = uniqueStrings(detail.Audios)
	detail.Files = uniqueStrings(detail.Files)
	detail.ReferenceImages = uniqueStrings(detail.ReferenceImages)
	detail.ExpiredImages = uniqueStrings(detail.ExpiredImages)
	detail.ExpiredVideos = uniqueStrings(detail.ExpiredVideos)
	detail.ExpiredFiles = uniqueStrings(detail.ExpiredFiles)
	detail.ExpiredReferences = uniqueStrings(detail.ExpiredReferences)
	detail.Images = preferDisplayAssets(detail.Images)
	detail.Videos = preferDisplayAssets(detail.Videos)
	generated := map[string]bool{}
	for _, value := range append(append([]string{}, detail.Images...), detail.Videos...) {
		generated[value] = true
	}
	files := make([]string, 0, len(detail.Files))
	for _, value := range detail.Files {
		if !generated[value] {
			files = append(files, value)
		}
	}
	detail.Files = files
	references := make([]string, 0, len(detail.ReferenceImages))
	for _, value := range detail.ReferenceImages {
		if !generated[value] {
			references = append(references, value)
		}
	}
	detail.ReferenceImages = references
	return detail
}

func preferDisplayAssets(values []string) []string {
	values = uniqueStrings(values)
	local := make([]string, 0)
	remote := make([]string, 0)
	proxy := make([]string, 0)
	for _, value := range values {
		switch {
		case strings.HasPrefix(value, TaskCenterAssetURLPrefix+"/"):
			local = append(local, value)
		case isProxyContentURL(value):
			proxy = append(proxy, value)
		default:
			remote = append(remote, value)
		}
	}
	if len(local) > 0 {
		return local[:1]
	}
	if len(remote) > 0 {
		return remote[:1]
	}
	if len(proxy) > 0 {
		return proxy[:1]
	}
	return nil
}

func moveImageLikeVideosToImages(detail TaskCenterDetail) TaskCenterDetail {
	videos := make([]string, 0, len(detail.Videos))
	for _, value := range detail.Videos {
		if isImageAssetURL(value) {
			detail.Images = append(detail.Images, value)
			continue
		}
		videos = append(videos, value)
	}
	detail.Videos = videos
	return detail
}

func isImageAssetURL(value string) bool {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "data:image/") {
		return true
	}
	u, err := url.Parse(value)
	if err != nil {
		return false
	}
	ext := strings.ToLower(filepath.Ext(u.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif":
		return true
	default:
		return false
	}
}

func isProxyContentURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	u, err := url.Parse(value)
	if err != nil {
		return false
	}
	return strings.Contains(u.Path, "/content") && (strings.Contains(u.Path, "/videos/") || strings.Contains(u.Path, "/images/"))
}

func marshalTaskCenterDetail(detail TaskCenterDetail) string {
	detail = normalizeTaskCenterDetail(detail)
	b, err := common.Marshal(detail)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func parseTaskCenterDetail(value string) TaskCenterDetail {
	var detail TaskCenterDetail
	if strings.TrimSpace(value) == "" {
		return detail
	}
	_ = common.UnmarshalJsonStr(value, &detail)
	return detail
}

func mergeTaskCenterDetail(base TaskCenterDetail, next TaskCenterDetail) TaskCenterDetail {
	if base.Prompt == "" {
		base.Prompt = next.Prompt
	}
	if base.NegativePrompt == "" {
		base.NegativePrompt = next.NegativePrompt
	}
	if base.InputText == "" {
		base.InputText = next.InputText
	}
	if base.OutputText == "" {
		base.OutputText = next.OutputText
	}
	if base.Size == "" {
		base.Size = next.Size
	}
	if base.Ratio == "" {
		base.Ratio = next.Ratio
	}
	if base.Style == "" {
		base.Style = next.Style
	}
	if base.Quality == "" {
		base.Quality = next.Quality
	}
	if base.Duration == "" {
		base.Duration = next.Duration
	}
	if base.Provider == "" {
		base.Provider = next.Provider
	}
	base.Images = uniqueStrings(append(base.Images, next.Images...))
	base.Videos = uniqueStrings(append(base.Videos, next.Videos...))
	base.Audios = uniqueStrings(append(base.Audios, next.Audios...))
	base.Files = uniqueStrings(append(base.Files, next.Files...))
	base.ReferenceImages = uniqueStrings(append(base.ReferenceImages, next.ReferenceImages...))
	base.ExpiredImages = uniqueStrings(append(base.ExpiredImages, next.ExpiredImages...))
	base.ExpiredVideos = uniqueStrings(append(base.ExpiredVideos, next.ExpiredVideos...))
	base.ExpiredFiles = uniqueStrings(append(base.ExpiredFiles, next.ExpiredFiles...))
	base.ExpiredReferences = uniqueStrings(append(base.ExpiredReferences, next.ExpiredReferences...))
	if base.Metadata == nil {
		base.Metadata = map[string]any{}
	}
	for key, value := range next.Metadata {
		if _, ok := base.Metadata[key]; !ok {
			base.Metadata[key] = value
		}
	}
	if len(base.Metadata) == 0 {
		base.Metadata = nil
	}
	return normalizeTaskCenterDetail(base)
}

func hasLocalTaskCenterAsset(values []string) bool {
	for _, value := range values {
		if strings.HasPrefix(strings.TrimSpace(value), TaskCenterAssetURLPrefix+"/") {
			return true
		}
	}
	return false
}

func preserveTaskCenterDetail(existing TaskCenterDetail, incoming TaskCenterDetail) TaskCenterDetail {
	if incoming.Prompt == "" {
		incoming.Prompt = existing.Prompt
	}
	if incoming.NegativePrompt == "" {
		incoming.NegativePrompt = existing.NegativePrompt
	}
	if incoming.InputText == "" {
		incoming.InputText = existing.InputText
	}
	if incoming.OutputText == "" {
		incoming.OutputText = existing.OutputText
	}
	if incoming.Size == "" {
		incoming.Size = existing.Size
	}
	if incoming.Ratio == "" {
		incoming.Ratio = existing.Ratio
	}
	if incoming.Style == "" {
		incoming.Style = existing.Style
	}
	if incoming.Quality == "" {
		incoming.Quality = existing.Quality
	}
	if incoming.Duration == "" {
		incoming.Duration = existing.Duration
	}
	if hasLocalTaskCenterAsset(existing.Images) {
		incoming.Images = existing.Images
	}
	if hasLocalTaskCenterAsset(existing.Videos) {
		incoming.Videos = existing.Videos
	}
	if hasLocalTaskCenterAsset(existing.Files) {
		incoming.Files = existing.Files
	}
	if hasLocalTaskCenterAsset(existing.ReferenceImages) {
		incoming.ReferenceImages = existing.ReferenceImages
	} else {
		incoming.ReferenceImages = uniqueStrings(append(incoming.ReferenceImages, existing.ReferenceImages...))
	}
	incoming.ExpiredImages = uniqueStrings(append(incoming.ExpiredImages, existing.ExpiredImages...))
	incoming.ExpiredVideos = uniqueStrings(append(incoming.ExpiredVideos, existing.ExpiredVideos...))
	incoming.ExpiredFiles = uniqueStrings(append(incoming.ExpiredFiles, existing.ExpiredFiles...))
	incoming.ExpiredReferences = uniqueStrings(append(incoming.ExpiredReferences, existing.ExpiredReferences...))
	return normalizeTaskCenterDetail(incoming)
}

func isLikelyAssetURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	if strings.HasPrefix(value, "data:image/") || strings.HasPrefix(value, "data:video/") {
		return true
	}
	u, err := url.Parse(value)
	if err != nil {
		return false
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

func stringFromAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		return ""
	}
}

func collectStringValues(value any) []string {
	values := make([]string, 0)
	switch v := value.(type) {
	case string:
		if strings.TrimSpace(v) != "" {
			values = append(values, strings.TrimSpace(v))
		}
	case []any:
		for _, item := range v {
			values = append(values, collectStringValues(item)...)
		}
	case map[string]any:
		for _, key := range []string{"url", "image_url", "video_url", "uri", "src", "b64_json"} {
			if item, ok := v[key]; ok {
				values = append(values, collectStringValues(item)...)
			}
		}
	}
	return uniqueStrings(values)
}

func collectAssetValuesFromKeys(data map[string]any, keys ...string) []string {
	values := make([]string, 0)
	for _, key := range keys {
		values = append(values, collectStringValues(data[key])...)
	}
	return uniqueStrings(values)
}

func collectNestedTaskCenterDetail(value any) TaskCenterDetail {
	detail := TaskCenterDetail{}
	switch v := value.(type) {
	case []any:
		for _, item := range v {
			detail = mergeTaskCenterDetail(detail, collectNestedTaskCenterDetail(item))
		}
	case map[string]any:
		detail = mergeTaskCenterDetail(detail, extractTaskCenterDetailFromMap(v))
	}
	return detail
}

func rawMessageToAny(raw []byte) any {
	if len(raw) == 0 {
		return nil
	}
	var value any
	if err := common.Unmarshal(raw, &value); err != nil {
		return nil
	}
	return value
}

func extractTaskCenterDetailFromMap(data map[string]any) TaskCenterDetail {
	detail := TaskCenterDetail{}
	if len(data) == 0 {
		return detail
	}
	if prompt := firstNonEmptyStringFromMap(data, "prompt", "input", "text", "description"); prompt != "" {
		detail.Prompt = prompt
	}
	if negativePrompt := firstNonEmptyStringFromMap(data, "negative_prompt", "negativePrompt"); negativePrompt != "" {
		detail.NegativePrompt = negativePrompt
	}
	if size := firstNonEmptyStringFromMap(data, "size"); size != "" {
		detail.Size = size
	}
	if ratio := firstNonEmptyStringFromMap(data, "ratio", "aspect_ratio", "aspectRatio"); ratio != "" {
		detail.Ratio = ratio
	}
	if style := firstNonEmptyStringFromMap(data, "style"); style != "" {
		detail.Style = style
	}
	if quality := firstNonEmptyStringFromMap(data, "quality", "quality_level", "qualityLevel"); quality != "" {
		detail.Quality = quality
	}
	if duration := firstNonEmptyStringFromMap(data, "duration", "seconds"); duration != "" {
		detail.Duration = duration
	}

	for _, value := range collectAssetValuesFromKeys(
		data,
		"image", "images", "image_url", "image_urls", "input_image", "input_images",
		"input_reference", "reference_image", "reference_images", "first_frame_image",
		"first_frame_url", "last_frame_image", "last_frame_url", "mask",
	) {
		if isLikelyAssetURL(value) {
			detail.ReferenceImages = append(detail.ReferenceImages, value)
		}
	}
	realVideos := make([]string, 0)
	proxyVideos := make([]string, 0)
	for _, value := range collectAssetValuesFromKeys(data, "video_url", "video_urls", "url", "result_url", "video", "videos", "output_video", "content_url") {
		if !isLikelyAssetURL(value) {
			continue
		}
		if isProxyContentURL(value) {
			proxyVideos = append(proxyVideos, value)
		} else {
			realVideos = append(realVideos, value)
		}
	}
	if len(realVideos) > 0 {
		detail.Videos = append(detail.Videos, realVideos...)
	} else {
		detail.Videos = append(detail.Videos, proxyVideos...)
	}
	for _, value := range collectAssetValuesFromKeys(data, "output_image", "output_images", "generated_images") {
		if isLikelyAssetURL(value) {
			detail.Images = append(detail.Images, value)
		}
	}
	detail = mergeTaskCenterDetail(detail, collectNestedTaskCenterDetail(data["data"]))
	if metadata, ok := data["metadata"].(map[string]any); ok {
		nested := extractTaskCenterDetailFromMap(metadata)
		detail = mergeTaskCenterDetail(detail, nested)
	}
	return normalizeTaskCenterDetail(detail)
}

func firstNonEmptyStringFromMap(data map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key]; ok {
			if text := stringFromAny(value); text != "" {
				return text
			}
		}
	}
	return ""
}

func LocalTaskCenterAssetPath(relativePath string) (string, bool) {
	clean := filepath.Clean(strings.TrimLeft(relativePath, "/\\"))
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", false
	}
	root, err := filepath.Abs(taskCenterAssetRoot)
	if err != nil {
		return "", false
	}
	target, err := filepath.Abs(filepath.Join(root, clean))
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(root, target)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	return target, true
}

func LocalizeTaskCenterAssetsAsync(taskID string) {
	if strings.TrimSpace(taskID) == "" {
		return
	}
	go func() {
		if err := localizeTaskCenterAssets(taskID); err != nil {
			common.SysLog("failed to localize task center assets: " + err.Error())
		}
	}()
}

func localizeTaskCenterAssets(taskID string) error {
	var record TaskCenter
	if err := DB.Where("task_id = ?", taskID).First(&record).Error; err != nil {
		return err
	}
	detail := parseTaskCenterDetail(record.Detail)
	before := marshalTaskCenterDetail(detail)
	changed := false
	detail.Images, changed = localizeTaskCenterURLList(taskID, "images", detail.Images, changed)
	detail.Videos, changed = localizeTaskCenterURLList(taskID, "videos", detail.Videos, changed)
	detail.ReferenceImages, changed = localizeTaskCenterURLList(taskID, "references", detail.ReferenceImages, changed)
	if record.TaskType == TaskCenterTypeImage {
		detail = moveImageLikeVideosToImages(detail)
	}
	after := marshalTaskCenterDetail(detail)
	if !changed && after == before {
		return nil
	}
	return DB.Model(&TaskCenter{}).Where("id = ?", record.ID).Updates(map[string]any{
		"detail":     after,
		"updated_at": time.Now().Unix(),
	}).Error
}

func NormalizeTaskCenterDetail(record *TaskCenter) error {
	if record == nil || record.ID <= 0 {
		return nil
	}
	detail := parseTaskCenterDetail(record.Detail)
	var rawResponse map[string]any
	if strings.TrimSpace(record.RawResponse) != "" && common.UnmarshalJsonStr(record.RawResponse, &rawResponse) == nil {
		detail = preserveTaskCenterDetail(detail, mergeTaskCenterDetail(detail, extractTaskCenterDetailFromMap(rawResponse)))
	}
	if record.TaskType == TaskCenterTypeImage {
		detail = moveImageLikeVideosToImages(detail)
	}
	normalized := marshalTaskCenterDetail(detail)
	if normalized == record.Detail {
		return nil
	}
	record.Detail = normalized
	return DB.Model(&TaskCenter{}).Where("id = ?", record.ID).Updates(map[string]any{
		"detail":     normalized,
		"updated_at": time.Now().Unix(),
	}).Error
}

func localizeTaskCenterURLList(taskID string, category string, urls []string, changed bool) ([]string, bool) {
	next := make([]string, 0, len(urls))
	for _, item := range urls {
		localURL := localizeTaskCenterAsset(taskID, category, item)
		if localURL != item {
			changed = true
		}
		next = append(next, localURL)
	}
	return uniqueStrings(next), changed
}

func localizeTaskCenterAsset(taskID string, category string, value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(value, TaskCenterAssetURLPrefix+"/") {
		return value
	}
	if strings.HasPrefix(value, "data:image/") || strings.HasPrefix(value, "data:video/") {
		if localURL, err := saveTaskCenterDataURI(taskID, category, value); err == nil {
			return localURL
		}
		return value
	}
	if category == "images" && looksLikeBase64(value) {
		if localURL, err := saveTaskCenterDataURI(taskID, category, "data:image/png;base64,"+value); err == nil {
			return localURL
		}
	}
	if strings.HasPrefix(value, "data:") {
		if localURL, err := saveTaskCenterDataURI(taskID, category, value); err == nil {
			return localURL
		}
		return value
	}
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return value
	}
	if localURL, err := downloadTaskCenterAsset(taskID, category, value); err == nil {
		return localURL
	}
	return value
}

func looksLikeBase64(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) < 128 || strings.Contains(value, "://") || strings.Contains(value, " ") {
		return false
	}
	for _, ch := range value {
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '+' || ch == '/' || ch == '=' {
			continue
		}
		return false
	}
	return true
}

func taskCenterAssetURL(taskID string, category string, filename string) string {
	return TaskCenterAssetURLPrefix + "/" + url.PathEscape(taskID) + "/" + url.PathEscape(category) + "/" + url.PathEscape(filename)
}

func saveTaskCenterDataURI(taskID string, category string, value string) (string, error) {
	comma := strings.Index(value, ",")
	if comma <= 0 {
		return "", errors.New("invalid data uri")
	}
	header := value[:comma]
	payload := value[comma+1:]
	if !strings.Contains(header, ";base64") {
		return "", errors.New("unsupported data uri")
	}
	mediaType := strings.TrimPrefix(strings.Split(header, ";")[0], "data:")
	bytes, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", err
	}
	if len(bytes) > taskCenterAssetMaxBytes {
		return "", errors.New("asset too large")
	}
	ext := extensionFromContentType(mediaType)
	if ext == "" {
		ext = ".bin"
	}
	hash := sha256.Sum256([]byte(value))
	filename := hex.EncodeToString(hash[:]) + ext
	if err := writeTaskCenterAsset(taskID, category, filename, bytes); err != nil {
		return "", err
	}
	return taskCenterAssetURL(taskID, category, filename), nil
}

func downloadTaskCenterAsset(taskID string, category string, assetURL string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), taskCenterAssetTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, assetURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", taskCenterAssetHTTPClient+" Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36")
	req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
	if parsed, err := url.Parse(assetURL); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		req.Header.Set("Referer", parsed.Scheme+"://"+parsed.Host+"/")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("unexpected status code %d", resp.StatusCode)
	}
	limited := io.LimitReader(resp.Body, taskCenterAssetMaxBytes+1)
	bytes, err := io.ReadAll(limited)
	if err != nil {
		return "", err
	}
	if len(bytes) > taskCenterAssetMaxBytes {
		return "", errors.New("asset too large")
	}
	ext := extensionFromURL(assetURL)
	if ext == "" {
		ext = extensionFromContentType(resp.Header.Get("Content-Type"))
	}
	if ext == "" {
		ext = ".bin"
	}
	hash := sha256.Sum256([]byte(assetURL))
	filename := hex.EncodeToString(hash[:]) + ext
	if err := writeTaskCenterAsset(taskID, category, filename, bytes); err != nil {
		return "", err
	}
	return taskCenterAssetURL(taskID, category, filename), nil
}

func writeTaskCenterAsset(taskID string, category string, filename string, data []byte) error {
	relative := filepath.Join(taskID, category, filename)
	target, ok := LocalTaskCenterAssetPath(relative)
	if !ok {
		return errors.New("invalid asset path")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	return os.WriteFile(target, data, 0644)
}

func extensionFromURL(value string) string {
	u, err := url.Parse(value)
	if err != nil {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(u.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm", ".m4v":
		return ext
	default:
		return ""
	}
}

func extensionFromContentType(contentType string) string {
	contentType = strings.TrimSpace(strings.Split(contentType, ";")[0])
	if contentType == "" {
		return ""
	}
	if exts, err := mime.ExtensionsByType(contentType); err == nil && len(exts) > 0 {
		return exts[0]
	}
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "video/mp4":
		return ".mp4"
	default:
		return ""
	}
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
	var user User
	if err := DB.Select("username").Where("id = ?", userID).First(&user).Error; err == nil {
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

func inferTaskCenterSubmitSource(source string) string {
	switch source {
	case TaskCenterSourceWorkspaceImage, TaskCenterSourceWorkspaceVideo:
		return TaskCenterSubmitSourceWorkspace
	case TaskCenterSourceMidjourney:
		return TaskCenterSubmitSourceSystem
	default:
		return TaskCenterSubmitSourceAPI
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
	source := TaskCenterSourceTask
	if task.PrivateData.WorkspaceSource != "" {
		source = task.PrivateData.WorkspaceSource
	}
	detail := TaskCenterDetail{
		Provider: string(task.Platform),
		Metadata: map[string]any{
			"action":      task.Action,
			"progress":    task.Progress,
			"result_url":  task.GetResultURL(),
			"properties":  task.Properties,
			"source":      source,
			"source_id":   task.ID,
			"channel_id":  task.ChannelId,
			"submit_time": task.SubmitTime,
		},
	}
	if source == TaskCenterSourceWorkspaceVideo {
		detail.Provider = TaskCenterSourceWorkspaceVideo
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
		detail = mergeTaskCenterDetail(detail, extractTaskCenterDetailFromMap(data))
		if model, ok := data["model"].(string); ok && model != "" {
			detail.Metadata["model"] = model
		}
		if metadata, ok := data["metadata"].(map[string]any); ok {
			detail.Metadata["request_metadata"] = metadata
		}
	}
	return marshalTaskCenterDetail(moveImageLikeVideosToImages(detail))
}

func BuildTaskCenterFromTask(task *Task) *TaskCenter {
	taskType := inferTaskCenterTypeFromTask(task)
	source := TaskCenterSourceTask
	if task.PrivateData.WorkspaceSource != "" {
		source = task.PrivateData.WorkspaceSource
	}
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
	if source == TaskCenterSourceWorkspaceVideo {
		tags = []string{"workspace", "video", "generation", normalizeTaskCenterStatus(string(task.Status))}
	}
	rawResponse := ""
	if len(task.Data) > 0 {
		rawResponse = string(task.Data)
	}
	return &TaskCenter{
		Source:           source,
		SubmitSource:     inferTaskCenterSubmitSource(source),
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
	return marshalTaskCenterDetail(detail)
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
		SubmitSource:     inferTaskCenterSubmitSource(TaskCenterSourceMidjourney),
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

func styleRawToString(style []byte) string {
	value := strings.TrimSpace(string(style))
	if value == "" || value == "null" {
		return ""
	}
	var text string
	if common.Unmarshal(style, &text) == nil {
		return text
	}
	return value
}

func buildTaskCenterDetailFromImage(source string, provider string, request dto.ImageRequest, response *dto.ImageResponse, taskID string, channelIDs []string) string {
	images := make([]string, 0)
	revisedPrompts := make([]string, 0)
	referenceImages := make([]string, 0)
	if response != nil {
		for _, item := range response.Data {
			if item.Url != "" {
				images = append(images, item.Url)
			}
			if item.B64Json != "" {
				images = append(images, "data:image/png;base64,"+item.B64Json)
			}
			if item.RevisedPrompt != "" {
				revisedPrompts = append(revisedPrompts, item.RevisedPrompt)
			}
		}
	}
	for _, raw := range [][]byte{request.Image, request.Images, request.Mask} {
		for _, value := range collectStringValues(rawMessageToAny(raw)) {
			if isLikelyAssetURL(value) {
				referenceImages = append(referenceImages, value)
			}
		}
	}
	extraMap := make(map[string]any)
	for key, raw := range request.Extra {
		extraMap[key] = rawMessageToAny(raw)
	}
	extracted := extractTaskCenterDetailFromMap(extraMap)
	referenceImages = append(referenceImages, extracted.ReferenceImages...)
	metadata := map[string]any{
		"source":          source,
		"task_id":         taskID,
		"response_format": request.ResponseFormat,
	}
	if request.N != nil {
		metadata["n"] = *request.N
	}
	if len(channelIDs) > 0 {
		metadata["channel_ids"] = channelIDs
	}
	if len(revisedPrompts) > 0 {
		metadata["revised_prompts"] = revisedPrompts
	}
	detail := TaskCenterDetail{
		Prompt:          request.Prompt,
		Images:          images,
		ReferenceImages: referenceImages,
		Size:            request.Size,
		Style:           styleRawToString(request.Style),
		Quality:         request.Quality,
		Provider:        provider,
		Metadata:        metadata,
	}
	return marshalTaskCenterDetail(detail)
}

func ExtractWorkspaceImageTaskCost(requestID string) int {
	if requestID == "" {
		return 0
	}
	var log Log
	err := LOG_DB.Where("request_id = ? AND type = ?", requestID, LogTypeConsume).Order("id desc").First(&log).Error
	if err != nil {
		return 0
	}
	return log.Quota
}

func BuildTaskCenterFromWorkspaceImage(taskID string, userID int, request dto.ImageRequest, rawRequest string, rawResponse string, response *dto.ImageResponse, status string, submittedAt int64, completedAt int64, cost int, errorMessage string, errorDetail string, channelIDs []string) *TaskCenter {
	tags := []string{"workspace", "image", "generation", normalizeTaskCenterStatus(status)}
	return &TaskCenter{
		Source:           TaskCenterSourceWorkspaceImage,
		SubmitSource:     TaskCenterSubmitSourceWorkspace,
		SourceID:         taskID,
		TaskID:           taskID,
		UserID:           userID,
		UsernameSnapshot: usernameSnapshot(userID),
		TaskType:         TaskCenterTypeImage,
		Tags:             tagsToString(tags),
		Model:            request.Model,
		Status:           normalizeTaskCenterStatus(status),
		Cost:             cost,
		SubmittedAt:      submittedAt,
		CompletedAt:      completedAt,
		Detail:           buildTaskCenterDetailFromImage(TaskCenterSourceWorkspaceImage, "workspace_image", request, response, taskID, channelIDs),
		RawRequest:       rawRequest,
		RawResponse:      rawResponse,
		ErrorMessage:     errorMessage,
		ErrorDetail:      errorDetail,
	}
}

func BuildTaskCenterFromAPIImage(taskID string, userID int, request dto.ImageRequest, rawRequest string, rawResponse string, response *dto.ImageResponse, status string, submittedAt int64, completedAt int64, cost int, errorMessage string, errorDetail string, channelIDs []string) *TaskCenter {
	tags := []string{"api", "image", "generation", normalizeTaskCenterStatus(status)}
	return &TaskCenter{
		Source:           TaskCenterSourceAPIImage,
		SubmitSource:     TaskCenterSubmitSourceAPI,
		SourceID:         taskID,
		TaskID:           taskID,
		UserID:           userID,
		UsernameSnapshot: usernameSnapshot(userID),
		TaskType:         TaskCenterTypeImage,
		Tags:             tagsToString(tags),
		Model:            request.Model,
		Status:           normalizeTaskCenterStatus(status),
		Cost:             cost,
		SubmittedAt:      submittedAt,
		CompletedAt:      completedAt,
		Detail:           buildTaskCenterDetailFromImage(TaskCenterSourceAPIImage, "api_image", request, response, taskID, channelIDs),
		RawRequest:       rawRequest,
		RawResponse:      rawResponse,
		ErrorMessage:     errorMessage,
		ErrorDetail:      errorDetail,
	}
}

func UpsertTaskCenter(record *TaskCenter) error {
	return upsertTaskCenter(record, true)
}

func upsertTaskCenter(record *TaskCenter, localizeAssets bool) error {
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
		previousDetail := parseTaskCenterDetail(existing.Detail)
		existing = *record
		existing.ID = existingID
		existing.Remark = remark
		if rawRequest != "" && existing.RawRequest == "" {
			existing.RawRequest = rawRequest
		}
		existing.Detail = marshalTaskCenterDetail(preserveTaskCenterDetail(previousDetail, parseTaskCenterDetail(existing.Detail)))
		existing.UpdatedAt = now
		err = DB.Model(&TaskCenter{}).Where("id = ?", existing.ID).Updates(map[string]any{
			"source":            existing.Source,
			"submit_source":     existing.SubmitSource,
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
		if err == nil && localizeAssets {
			LocalizeTaskCenterAssetsAsync(record.TaskID)
		}
		return err
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	record.CreatedAt = now
	record.UpdatedAt = now
	err = DB.Create(record).Error
	if err == nil && localizeAssets {
		LocalizeTaskCenterAssetsAsync(record.TaskID)
	}
	return err
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
	var record TaskCenter
	if err := DB.Where("task_id = ?", taskID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	detail := parseTaskCenterDetail(record.Detail)
	var rawMap map[string]any
	if err := common.Unmarshal(b, &rawMap); err == nil {
		detail = preserveTaskCenterDetail(detail, mergeTaskCenterDetail(detail, extractTaskCenterDetailFromMap(rawMap)))
	}
	err = DB.Model(&TaskCenter{}).Where("id = ?", record.ID).Updates(map[string]any{
		"raw_request": string(b),
		"detail":      marshalTaskCenterDetail(detail),
		"updated_at":  time.Now().Unix(),
	}).Error
	if err == nil {
		LocalizeTaskCenterAssetsAsync(taskID)
	}
	return err
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
	if params.SubmitSource != "" {
		query = query.Where("submit_source = ?", params.SubmitSource)
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
			_ = upsertTaskCenter(BuildTaskCenterFromTask(task), false)
		}
	}
	var mjTasks []*Midjourney
	if err := DB.Order("id desc").Limit(limit).Find(&mjTasks).Error; err == nil {
		for _, task := range mjTasks {
			_ = upsertTaskCenter(BuildTaskCenterFromMidjourney(task), false)
		}
	}
	BackfillTaskCenterSubmitSources()
}

func BackfillTaskCenterSubmitSources() {
	if !DB.Migrator().HasTable(&TaskCenter{}) || !DB.Migrator().HasColumn(&TaskCenter{}, "submit_source") {
		return
	}
	if err := DB.Model(&TaskCenter{}).
		Where("submit_source = '' OR submit_source IS NULL").
		Where("source IN ?", []string{TaskCenterSourceWorkspaceImage, TaskCenterSourceWorkspaceVideo}).
		Update("submit_source", TaskCenterSubmitSourceWorkspace).Error; err != nil {
		common.SysLog("failed to backfill workspace task center source: " + err.Error())
	}
	if err := DB.Model(&TaskCenter{}).
		Where("submit_source = '' OR submit_source IS NULL").
		Where("source = ?", TaskCenterSourceMidjourney).
		Update("submit_source", TaskCenterSubmitSourceSystem).Error; err != nil {
		common.SysLog("failed to backfill system task center source: " + err.Error())
	}
	if err := DB.Model(&TaskCenter{}).
		Where("submit_source = '' OR submit_source IS NULL").
		Update("submit_source", TaskCenterSubmitSourceAPI).Error; err != nil {
		common.SysLog("failed to backfill api task center source: " + err.Error())
	}
}
