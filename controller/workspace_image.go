package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	workspaceImageJobWorkerInterval       = 2 * time.Second
	workspaceImageJobWorkerBatchSize      = 4
	workspaceImageJobRunningStaleDuration = 30 * time.Minute
)

var startWorkspaceImageJobWorkerOnce sync.Once
var workspaceImageRunningJobs sync.Map
var workspaceImageRunningJobCancels sync.Map

type workspaceImageResponseRecorder struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *workspaceImageResponseRecorder) Write(data []byte) (int, error) {
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *workspaceImageResponseRecorder) WriteString(data string) (int, error) {
	w.body.WriteString(data)
	return w.ResponseWriter.WriteString(data)
}

func (w *workspaceImageResponseRecorder) Status() int {
	status := w.ResponseWriter.Status()
	if status == 0 {
		return http.StatusOK
	}
	return status
}

type workspaceImageChannelRequest struct {
	Id              int                                 `json:"id"`
	Weight          int                                 `json:"weight"`
	Model           string                              `json:"model"`
	ModelAlias      string                              `json:"model_alias"`
	CategoryId      int                                 `json:"category_id"`
	FeatureControls model.WorkspaceImageFeatureControls `json:"feature_controls"`
	FieldMappings   model.WorkspaceImageFieldMappings   `json:"field_mappings"`
	MaxBatchSize    int                                 `json:"max_batch_size"`
	SizePresets     []model.WorkspaceImagePreset        `json:"size_presets"`
	RatioPresets    []model.WorkspaceImagePreset        `json:"ratio_presets"`
	StylePresets    []model.WorkspaceImagePreset        `json:"style_presets"`
	QualityPresets  []model.WorkspaceImagePreset        `json:"quality_presets"`
	Disabled        bool                                `json:"disabled"`
	Remark          string                              `json:"remark"`
}

func AdminListWorkspaceImageCategories(c *gin.Context) {
	categories, err := model.GetWorkspaceImageCategories()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, categories)
}

func AdminCreateWorkspaceImageCategory(c *gin.Context) {
	var category model.WorkspaceImageCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	if err := model.CreateWorkspaceImageCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminUpdateWorkspaceImageCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var category model.WorkspaceImageCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	category.Id = id
	if err := model.UpdateWorkspaceImageCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminDeleteWorkspaceImageCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceImageCategory(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListWorkspaceImageChannels(c *gin.Context) {
	channels, err := model.GetWorkspaceImageChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channels)
}

func workspaceImageRequestToChannel(req workspaceImageChannelRequest) model.WorkspaceImageChannel {
	return model.WorkspaceImageChannel{
		Id:              req.Id,
		Weight:          req.Weight,
		Model:           req.Model,
		ModelAlias:      req.ModelAlias,
		CategoryId:      req.CategoryId,
		FeatureControls: workspaceImageFeatureControlsToString(req.FeatureControls),
		FieldMappings:   workspaceImageFieldMappingsToString(req.FieldMappings),
		MaxBatchSize:    req.MaxBatchSize,
		SizePresets:     workspaceImagePresetsToString(req.SizePresets),
		RatioPresets:    workspaceImagePresetsToString(req.RatioPresets),
		StylePresets:    workspaceImagePresetsToString(req.StylePresets),
		QualityPresets:  workspaceImagePresetsToString(req.QualityPresets),
		Disabled:        req.Disabled,
		Remark:          req.Remark,
	}
}

func workspaceImageFeatureControlsToString(controls model.WorkspaceImageFeatureControls) string {
	b, err := common.Marshal(controls)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func workspaceImageFieldMappingsToString(mappings model.WorkspaceImageFieldMappings) string {
	b, err := common.Marshal(model.NormalizeWorkspaceImageFieldMappings(mappings))
	if err != nil {
		return "{}"
	}
	return string(b)
}

func workspaceImagePresetsToString(presets []model.WorkspaceImagePreset) string {
	b, err := common.Marshal(presets)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func AdminCreateWorkspaceImageChannel(c *gin.Context) {
	var req workspaceImageChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceImageCategoryExists(req.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceImageModelAvailable(req.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	channel := workspaceImageRequestToChannel(req)
	if err := model.CreateWorkspaceImageChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminUpdateWorkspaceImageChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var req workspaceImageChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceImageCategoryExists(req.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceImageModelAvailable(req.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Id = id
	channel := workspaceImageRequestToChannel(req)
	if err := model.UpdateWorkspaceImageChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminDeleteWorkspaceImageChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceImageChannel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminWorkspaceImageAvailableModels(c *gin.Context) {
	common.ApiSuccess(c, model.GetWorkspaceImageAvailableModels())
}

func GetWorkspaceImageModels(c *gin.Context) {
	models, err := model.GetWorkspaceImageModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, models)
}

func readWorkspaceImageGenerationRequest(c *gin.Context) (dto.ImageRequest, string, error) {
	var imageRequest dto.ImageRequest
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return imageRequest, "", err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return imageRequest, "", err
	}
	if err := common.Unmarshal(requestBody, &imageRequest); err != nil {
		return imageRequest, string(requestBody), err
	}
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return imageRequest, string(requestBody), seekErr
	}
	c.Request.Body = io.NopCloser(storage)
	return imageRequest, string(requestBody), nil
}

func validateWorkspaceImageGenerationRequest(request dto.ImageRequest) (*model.WorkspaceImageModel, error) {
	channel, err := model.GetWorkspaceImageModel(request.Model)
	if err != nil {
		return nil, err
	}
	count := uint(1)
	if request.N != nil {
		count = *request.N
	}
	maxBatchSize := channel.MaxBatchSize
	if maxBatchSize <= 0 {
		maxBatchSize = 4
	}
	if !channel.FeatureControls.BatchControl && count > 1 {
		return nil, errors.New("selected image channel does not support generation count control")
	}
	if count > uint(maxBatchSize) {
		return nil, fmt.Errorf("generation count exceeds channel limit: max %d", maxBatchSize)
	}
	return channel, nil
}

func workspaceImageRawField(raw map[string]any, field string) (any, bool) {
	field = strings.TrimSpace(field)
	if field == "" {
		return nil, false
	}
	value, ok := raw[field]
	if !ok || value == nil {
		return nil, false
	}
	if s, ok := value.(string); ok && strings.TrimSpace(s) == "" {
		return nil, false
	}
	return value, true
}

func applyWorkspaceImageMappedFields(c *gin.Context, request *dto.ImageRequest, rawRequest string, channel *model.WorkspaceImageModel) {
	if request == nil || channel == nil || strings.TrimSpace(rawRequest) == "" {
		return
	}
	var raw map[string]any
	if err := common.Unmarshal([]byte(rawRequest), &raw); err != nil {
		return
	}
	controls := channel.FeatureControls
	mappings := model.NormalizeWorkspaceImageFieldMappings(channel.FieldMappings)
	extra := make(map[string]any)
	addMapped := func(enabled bool, sourceField string, fallbackValue any) {
		if !enabled {
			return
		}
		targetField := strings.TrimSpace(sourceField)
		if targetField == "" {
			return
		}
		if value, ok := workspaceImageRawField(raw, targetField); ok {
			extra[targetField] = value
			return
		}
		if fallbackValue != nil {
			if s, ok := fallbackValue.(string); ok && strings.TrimSpace(s) == "" {
				return
			}
			extra[targetField] = fallbackValue
		}
	}
	addMapped(controls.ReferenceImageUpload, mappings.ReferenceImage, nil)
	addMapped(controls.SizeControl, mappings.Size, request.Size)
	addMapped(controls.RatioControl, mappings.Ratio, nil)
	addMapped(controls.StyleControl, mappings.Style, nil)
	addMapped(controls.QualityControl, mappings.Quality, request.Quality)
	addMapped(controls.NegativePrompt, mappings.NegativePrompt, nil)
	addMapped(controls.SeedControl, mappings.Seed, nil)
	if len(extra) == 0 {
		return
	}
	b, err := common.Marshal(extra)
	if err != nil {
		return
	}
	request.ExtraFields = b
	c.Set("workspace_image_extra_fields", extra)
}

func newWorkspaceImageTaskID() string {
	key, err := common.GenerateRandomCharsKey(32)
	if err != nil || key == "" {
		key = fmt.Sprintf("%d%s", time.Now().UnixNano(), common.GetRandomString(8))
	}
	return "img_" + key
}

func newWorkspaceImageRequestID() string {
	return common.GetTimeString() + common.GetRandomString(16)
}

func newAPIImageTaskID() string {
	key, err := common.GenerateRandomCharsKey(32)
	if err != nil || key == "" {
		key = fmt.Sprintf("%d%s", time.Now().UnixNano(), common.GetRandomString(8))
	}
	return "img_api_" + key
}

func extractWorkspaceImageError(rawResponse string) (string, string) {
	if strings.TrimSpace(rawResponse) == "" {
		return "", ""
	}
	var payload map[string]any
	if err := common.Unmarshal([]byte(rawResponse), &payload); err != nil {
		return rawResponse, rawResponse
	}
	if errValue, ok := payload["error"]; ok {
		if errMap, ok := errValue.(map[string]any); ok {
			if msg, ok := errMap["message"].(string); ok && msg != "" {
				return msg, rawResponse
			}
		}
		if msg, ok := errValue.(string); ok && msg != "" {
			return msg, rawResponse
		}
	}
	if msg, ok := payload["message"].(string); ok && msg != "" {
		return msg, rawResponse
	}
	return rawResponse, rawResponse
}

func recordWorkspaceImageTaskCenter(c *gin.Context, taskID string, userID int, request dto.ImageRequest, rawRequest string, rawResponse string, submittedAt int64, statusCode int) {
	completedAt := time.Now().Unix()
	status := "succeeded"
	var imageResponse dto.ImageResponse
	responsePtr := &imageResponse
	errorMessage := ""
	errorDetail := ""
	if statusCode >= http.StatusBadRequest {
		status = "failed"
		responsePtr = nil
		errorMessage, errorDetail = extractWorkspaceImageError(rawResponse)
	} else if strings.TrimSpace(rawResponse) != "" {
		if err := common.Unmarshal([]byte(rawResponse), &imageResponse); err != nil {
			status = "failed"
			responsePtr = nil
			errorMessage = err.Error()
			errorDetail = rawResponse
		}
	}
	requestID := c.GetString(common.RequestIdKey)
	cost := model.ExtractWorkspaceImageTaskCost(requestID)
	record := model.BuildTaskCenterFromWorkspaceImage(
		taskID,
		userID,
		request,
		rawRequest,
		rawResponse,
		responsePtr,
		status,
		submittedAt,
		completedAt,
		cost,
		errorMessage,
		errorDetail,
		c.GetStringSlice("use_channel"),
	)
	if err := model.UpsertTaskCenter(record); err != nil {
		logger.LogError(c, "failed to record workspace image task center: "+err.Error())
	}
}

func recordWorkspaceImageSubmittedTaskCenter(c *gin.Context, taskID string, userID int, request dto.ImageRequest, rawRequest string, submittedAt int64) {
	record := model.BuildTaskCenterFromWorkspaceImage(
		taskID,
		userID,
		request,
		rawRequest,
		"",
		nil,
		"submitted",
		submittedAt,
		0,
		0,
		"",
		"",
		nil,
	)
	if err := model.UpsertTaskCenter(record); err != nil {
		logger.LogError(c, "failed to record submitted workspace image task center: "+err.Error())
	}
}

func workspaceImageResponseStatus(c *gin.Context) int {
	if c == nil || c.Writer == nil {
		return http.StatusInternalServerError
	}
	status := c.Writer.Status()
	if status == 0 {
		return http.StatusOK
	}
	return status
}

func workspaceImageErrorBody(err error) string {
	message := ""
	if err != nil {
		message = err.Error()
	}
	body, marshalErr := common.Marshal(gin.H{
		"error": gin.H{
			"message": message,
		},
	})
	if marshalErr != nil {
		return message
	}
	return string(body)
}

func newWorkspaceImageBackgroundContext() (*gin.Context, *httptest.ResponseRecorder) {
	ginRecorder := httptest.NewRecorder()
	bgCtx, _ := gin.CreateTestContext(ginRecorder)
	return bgCtx, ginRecorder
}

func runWorkspaceImageGenerationJob(taskID string, userID int, userGroup string, request dto.ImageRequest, rawRequest string, mappedBody []byte, submittedAt int64, extraFields map[string]any, requestContext context.Context) {
	bgCtx, ginRecorder := newWorkspaceImageBackgroundContext()
	defer func() {
		if panicValue := recover(); panicValue != nil {
			err := fmt.Errorf("workspace image generation panic: %v", panicValue)
			recordWorkspaceImageTaskCenter(bgCtx, taskID, userID, request, rawRequest, workspaceImageErrorBody(err), submittedAt, http.StatusInternalServerError)
		}
	}()
	storage, err := common.CreateBodyStorage(mappedBody)
	if err != nil {
		recordWorkspaceImageTaskCenter(bgCtx, taskID, userID, request, rawRequest, workspaceImageErrorBody(err), submittedAt, http.StatusInternalServerError)
		return
	}
	defer storage.Close()

	req := httptest.NewRequest(http.MethodPost, "/pg/images/generations", common.ReaderOnly(storage)).WithContext(requestContext)
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = int64(len(mappedBody))
	bgCtx.Request = req
	bgCtx.Set(common.KeyBodyStorage, storage)

	requestID := newWorkspaceImageRequestID()
	bgCtx.Set(common.RequestIdKey, requestID)
	bgCtx.Header(common.RequestIdKey, requestID)

	bgCtx.Set("relay_mode", relayconstant.RelayModeImagesGenerations)
	bgCtx.Request.URL.Path = "/pg/images/generations"
	common.SetContextKey(bgCtx, constant.ContextKeyUsingGroup, userGroup)
	if len(extraFields) > 0 {
		bgCtx.Set("workspace_image_extra_fields", extraFields)
	}

	userCache, err := model.GetUserCache(userID)
	if err != nil {
		recordWorkspaceImageTaskCenter(bgCtx, taskID, userID, request, rawRequest, workspaceImageErrorBody(err), submittedAt, http.StatusInternalServerError)
		return
	}
	userCache.WriteContext(bgCtx)
	tempToken := &model.Token{
		UserId: userID,
		Name:   fmt.Sprintf("workspace-image-%s", userGroup),
		Group:  userGroup,
	}
	_ = middleware.SetupContextForToken(bgCtx, tempToken)

	middleware.Distribute()(bgCtx)
	if bgCtx.IsAborted() {
		recordWorkspaceImageTaskCenter(bgCtx, taskID, userID, request, rawRequest, ginRecorder.Body.String(), submittedAt, workspaceImageResponseStatus(bgCtx))
		return
	}

	Relay(bgCtx, types.RelayFormatOpenAIImage)
	recordWorkspaceImageTaskCenter(bgCtx, taskID, userID, request, rawRequest, ginRecorder.Body.String(), submittedAt, workspaceImageResponseStatus(bgCtx))
}

func runWorkspaceImageJob(job model.WorkspaceImageJob) {
	if _, loaded := workspaceImageRunningJobs.LoadOrStore(job.TaskID, struct{}{}); loaded {
		return
	}
	defer workspaceImageRunningJobs.Delete(job.TaskID)

	staleBefore := time.Now().Add(-workspaceImageJobRunningStaleDuration).Unix()
	claimed, err := model.ClaimWorkspaceImageJob(job.TaskID, staleBefore)
	if err != nil {
		common.SysLog("failed to claim workspace image job: " + err.Error())
		return
	}
	if !claimed {
		return
	}
	jobContext, cancelJob := context.WithCancel(context.Background())
	workspaceImageRunningJobCancels.Store(job.TaskID, cancelJob)
	defer func() {
		cancelJob()
		workspaceImageRunningJobCancels.Delete(job.TaskID)
	}()
	stopHeartbeat := make(chan struct{})
	go func() {
		ticker := time.NewTicker(workspaceImageJobWorkerInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				_ = model.TouchWorkspaceImageJob(job.TaskID)
			case <-stopHeartbeat:
				return
			}
		}
	}()
	defer close(stopHeartbeat)

	var imageRequest dto.ImageRequest
	if err := common.UnmarshalJsonStr(job.RequestBody, &imageRequest); err != nil {
		_ = model.FinishWorkspaceImageJob(job.TaskID, model.WorkspaceImageJobStatusFailed, err.Error())
		bgCtx, _ := newWorkspaceImageBackgroundContext()
		recordWorkspaceImageTaskCenter(bgCtx, job.TaskID, job.UserID, imageRequest, job.RawRequest, workspaceImageErrorBody(err), job.SubmittedAt, http.StatusBadRequest)
		return
	}
	extraFields := map[string]any{}
	if strings.TrimSpace(job.ExtraFields) != "" {
		_ = common.UnmarshalJsonStr(job.ExtraFields, &extraFields)
	}

	runWorkspaceImageGenerationJob(job.TaskID, job.UserID, job.UserGroup, imageRequest, job.RawRequest, []byte(job.RequestBody), job.SubmittedAt, extraFields, jobContext)

	var record model.TaskCenter
	if err := model.DB.Where("task_id = ?", job.TaskID).First(&record).Error; err != nil {
		_ = model.FinishWorkspaceImageJob(job.TaskID, model.WorkspaceImageJobStatusFailed, err.Error())
		return
	}
	if record.Status == "cancelled" {
		_ = model.FinishWorkspaceImageJob(job.TaskID, model.WorkspaceImageJobStatusCancelled, record.ErrorMessage)
		return
	}
	if record.Status == "failed" {
		_ = model.FinishWorkspaceImageJob(job.TaskID, model.WorkspaceImageJobStatusFailed, record.ErrorMessage)
		return
	}
	_ = model.FinishWorkspaceImageJob(job.TaskID, model.WorkspaceImageJobStatusSucceeded, "")
}

func processWorkspaceImageJobs() {
	staleBefore := time.Now().Add(-workspaceImageJobRunningStaleDuration).Unix()
	jobs, err := model.ListRunnableWorkspaceImageJobs(workspaceImageJobWorkerBatchSize, staleBefore)
	if err != nil {
		common.SysLog("failed to list workspace image jobs: " + err.Error())
		return
	}
	for _, job := range jobs {
		job := job
		gopool.Go(func() {
			runWorkspaceImageJob(job)
		})
	}
}

func StartWorkspaceImageJobWorker() {
	startWorkspaceImageJobWorkerOnce.Do(func() {
		go func() {
			common.SysLog("workspace image job worker started")
			processWorkspaceImageJobs()
			ticker := time.NewTicker(workspaceImageJobWorkerInterval)
			defer ticker.Stop()
			for range ticker.C {
				processWorkspaceImageJobs()
			}
		}()
	})
}

func CancelRunningWorkspaceImageJob(taskID string) {
	if value, ok := workspaceImageRunningJobCancels.Load(taskID); ok {
		if cancel, ok := value.(context.CancelFunc); ok {
			cancel()
		}
	}
}

func recordAPIImageTaskCenter(c *gin.Context, taskID string, userID int, request dto.ImageRequest, rawRequest string, rawResponse string, submittedAt int64, statusCode int) {
	completedAt := time.Now().Unix()
	status := "succeeded"
	var imageResponse dto.ImageResponse
	responsePtr := &imageResponse
	errorMessage := ""
	errorDetail := ""
	if statusCode >= http.StatusBadRequest {
		status = "failed"
		responsePtr = nil
		errorMessage, errorDetail = extractWorkspaceImageError(rawResponse)
	} else if strings.TrimSpace(rawResponse) != "" {
		if err := common.Unmarshal([]byte(rawResponse), &imageResponse); err != nil {
			status = "failed"
			responsePtr = nil
			errorMessage = err.Error()
			errorDetail = rawResponse
		}
	}
	requestID := c.GetString(common.RequestIdKey)
	cost := model.ExtractWorkspaceImageTaskCost(requestID)
	record := model.BuildTaskCenterFromAPIImage(
		taskID,
		userID,
		request,
		rawRequest,
		rawResponse,
		responsePtr,
		status,
		submittedAt,
		completedAt,
		cost,
		errorMessage,
		errorDetail,
		c.GetStringSlice("use_channel"),
	)
	if err := model.UpsertTaskCenter(record); err != nil {
		logger.LogError(c, "failed to record api image task center: "+err.Error())
	}
}

func RelayAPIImageGeneration(c *gin.Context) {
	imageRequest, rawRequest, err := readWorkspaceImageGenerationRequest(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry()).ToOpenAIError(),
		})
		return
	}

	taskID := newAPIImageTaskID()
	userID := c.GetInt("id")
	submittedAt := time.Now().Unix()
	recorder := &workspaceImageResponseRecorder{
		ResponseWriter: c.Writer,
		body:           bytes.NewBuffer(nil),
	}
	c.Writer = recorder

	Relay(c, types.RelayFormatOpenAIImage)
	recordAPIImageTaskCenter(c, taskID, userID, imageRequest, rawRequest, recorder.body.String(), submittedAt, recorder.Status())
}

func GenerateWorkspaceImage(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("access token is not supported for workspace image generation"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	imageRequest, rawRequest, err := readWorkspaceImageGenerationRequest(c)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	imageChannel, err := validateWorkspaceImageGenerationRequest(imageRequest)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	applyWorkspaceImageMappedFields(c, &imageRequest, rawRequest, imageChannel)

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}

	taskID := newWorkspaceImageTaskID()
	submittedAt := time.Now().Unix()
	mappedBody, err := common.Marshal(imageRequest)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	extraFields := map[string]any{}
	if value, ok := c.Get("workspace_image_extra_fields"); ok {
		if extraMap, ok := value.(map[string]any); ok {
			for key, val := range extraMap {
				extraFields[key] = val
			}
		}
	}
	extraFieldsJSON := ""
	if len(extraFields) > 0 {
		if b, err := common.Marshal(extraFields); err == nil {
			extraFieldsJSON = string(b)
		}
	}
	recordWorkspaceImageSubmittedTaskCenter(c, taskID, userId, imageRequest, rawRequest, submittedAt)
	if err := model.CreateWorkspaceImageJob(&model.WorkspaceImageJob{
		TaskID:      taskID,
		UserID:      userId,
		UserGroup:   userCache.Group,
		RequestBody: string(mappedBody),
		RawRequest:  rawRequest,
		ExtraFields: extraFieldsJSON,
		SubmittedAt: submittedAt,
	}); err != nil {
		recordWorkspaceImageTaskCenter(c, taskID, userId, imageRequest, rawRequest, workspaceImageErrorBody(err), submittedAt, http.StatusInternalServerError)
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"id":      taskID,
		"task_id": taskID,
		"status":  "submitted",
		"created": submittedAt,
		"data":    []any{},
		"metadata": gin.H{
			"async":  true,
			"source": "workspace_image",
		},
	})
}
