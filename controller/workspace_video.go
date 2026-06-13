package controller

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type workspaceVideoChannelRequest struct {
	Id                int                                 `json:"id"`
	Weight            int                                 `json:"weight"`
	Model             string                              `json:"model"`
	ModelAlias        string                              `json:"model_alias"`
	CategoryId        int                                 `json:"category_id"`
	FeatureControls   model.WorkspaceVideoFeatureControls `json:"feature_controls"`
	FieldMappings     model.WorkspaceVideoFieldMappings   `json:"field_mappings"`
	MaxBatchSize      int                                 `json:"max_batch_size"`
	ResolutionPresets []model.WorkspaceVideoPreset        `json:"resolution_presets"`
	RatioPresets      []model.WorkspaceVideoPreset        `json:"ratio_presets"`
	DurationPresets   []model.WorkspaceVideoPreset        `json:"duration_presets"`
	FrameRatePresets  []model.WorkspaceVideoPreset        `json:"frame_rate_presets"`
	StylePresets      []model.WorkspaceVideoPreset        `json:"style_presets"`
	QualityPresets    []model.WorkspaceVideoPreset        `json:"quality_presets"`
	CameraPresets     []model.WorkspaceVideoPreset        `json:"camera_movement_presets"`
	Disabled          bool                                `json:"disabled"`
	Remark            string                              `json:"remark"`
}

func AdminListWorkspaceVideoCategories(c *gin.Context) {
	categories, err := model.GetWorkspaceVideoCategories()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, categories)
}

func AdminCreateWorkspaceVideoCategory(c *gin.Context) {
	var category model.WorkspaceVideoCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	if err := model.CreateWorkspaceVideoCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminUpdateWorkspaceVideoCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var category model.WorkspaceVideoCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	category.Id = id
	if err := model.UpdateWorkspaceVideoCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminDeleteWorkspaceVideoCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceVideoCategory(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListWorkspaceVideoChannels(c *gin.Context) {
	channels, err := model.GetWorkspaceVideoChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channels)
}

func workspaceVideoRequestToChannel(req workspaceVideoChannelRequest) model.WorkspaceVideoChannel {
	return model.WorkspaceVideoChannel{
		Id:                req.Id,
		Weight:            req.Weight,
		Model:             req.Model,
		ModelAlias:        req.ModelAlias,
		CategoryId:        req.CategoryId,
		FeatureControls:   workspaceVideoFeatureControlsToString(req.FeatureControls),
		FieldMappings:     workspaceVideoFieldMappingsToString(req.FieldMappings),
		MaxBatchSize:      req.MaxBatchSize,
		ResolutionPresets: workspaceVideoPresetsToString(req.ResolutionPresets),
		RatioPresets:      workspaceVideoPresetsToString(req.RatioPresets),
		DurationPresets:   workspaceVideoPresetsToString(req.DurationPresets),
		FrameRatePresets:  workspaceVideoPresetsToString(req.FrameRatePresets),
		StylePresets:      workspaceVideoPresetsToString(req.StylePresets),
		QualityPresets:    workspaceVideoPresetsToString(req.QualityPresets),
		CameraPresets:     workspaceVideoPresetsToString(req.CameraPresets),
		Disabled:          req.Disabled,
		Remark:            req.Remark,
	}
}

func workspaceVideoFeatureControlsToString(controls model.WorkspaceVideoFeatureControls) string {
	b, err := common.Marshal(controls)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func workspaceVideoPresetsToString(presets []model.WorkspaceVideoPreset) string {
	b, err := common.Marshal(presets)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func workspaceVideoFieldMappingsToString(mappings model.WorkspaceVideoFieldMappings) string {
	b, err := common.Marshal(model.NormalizeWorkspaceVideoFieldMappings(mappings))
	if err != nil {
		return "{}"
	}
	return string(b)
}

func AdminCreateWorkspaceVideoChannel(c *gin.Context) {
	var req workspaceVideoChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceVideoCategoryExists(req.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceVideoModelAvailable(req.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	channel := workspaceVideoRequestToChannel(req)
	if err := model.CreateWorkspaceVideoChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminUpdateWorkspaceVideoChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var req workspaceVideoChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceVideoCategoryExists(req.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceVideoModelAvailable(req.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Id = id
	channel := workspaceVideoRequestToChannel(req)
	if err := model.UpdateWorkspaceVideoChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminDeleteWorkspaceVideoChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceVideoChannel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminWorkspaceVideoAvailableModels(c *gin.Context) {
	common.ApiSuccess(c, model.GetWorkspaceVideoAvailableModels())
}

func GetWorkspaceVideoModels(c *gin.Context) {
	models, err := model.GetWorkspaceVideoModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, models)
}

func readWorkspaceVideoGenerationRequest(c *gin.Context) (relaycommon.TaskSubmitReq, string, error) {
	var request relaycommon.TaskSubmitReq
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return request, "", err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return request, "", err
	}
	if err := common.Unmarshal(requestBody, &request); err != nil {
		return request, string(requestBody), err
	}
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return request, string(requestBody), seekErr
	}
	c.Request.Body = io.NopCloser(storage)
	return request, string(requestBody), nil
}

func workspaceVideoMetadataHas(metadata map[string]interface{}, keys ...string) bool {
	if metadata == nil {
		return false
	}
	for _, key := range keys {
		value, ok := metadata[key]
		if !ok || value == nil {
			continue
		}
		if s, ok := value.(string); ok && strings.TrimSpace(s) == "" {
			continue
		}
		return true
	}
	return false
}

func workspaceVideoMetadataNumber(metadata map[string]interface{}, keys ...string) float64 {
	if metadata == nil {
		return 0
	}
	for _, key := range keys {
		value, ok := metadata[key]
		if !ok || value == nil {
			continue
		}
		switch v := value.(type) {
		case float64:
			return v
		case float32:
			return float64(v)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case string:
			var parsed float64
			if _, err := fmt.Sscanf(strings.TrimSpace(v), "%f", &parsed); err == nil {
				return parsed
			}
		}
	}
	return 0
}

func workspaceVideoMappedTarget(field string) string {
	target := strings.TrimSpace(field)
	target = strings.TrimPrefix(target, "metadata.")
	return strings.TrimSpace(target)
}

func workspaceVideoRawField(raw map[string]any, field string) (any, bool) {
	field = strings.TrimSpace(field)
	if field == "" {
		return nil, false
	}
	if value, ok := raw[field]; ok && value != nil {
		if s, ok := value.(string); ok && strings.TrimSpace(s) == "" {
			return nil, false
		}
		return value, true
	}
	metadata, _ := raw["metadata"].(map[string]any)
	if metadata == nil {
		return nil, false
	}
	field = strings.TrimPrefix(field, "metadata.")
	value, ok := metadata[field]
	if !ok || value == nil {
		return nil, false
	}
	if s, ok := value.(string); ok && strings.TrimSpace(s) == "" {
		return nil, false
	}
	return value, true
}

func workspaceVideoFirstRawField(raw map[string]any, fields ...string) (any, bool) {
	for _, field := range fields {
		if value, ok := workspaceVideoRawField(raw, field); ok {
			return value, true
		}
	}
	return nil, false
}

func setWorkspaceVideoMappedField(request *relaycommon.TaskSubmitReq, targetField string, value any) {
	if request == nil || value == nil {
		return
	}
	target := workspaceVideoMappedTarget(targetField)
	if target == "" {
		return
	}
	switch target {
	case "image":
		if s, ok := value.(string); ok {
			request.Image = s
		}
	case "images":
		switch v := value.(type) {
		case []string:
			request.Images = v
		case []any:
			images := make([]string, 0, len(v))
			for _, item := range v {
				if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
					images = append(images, s)
				}
			}
			request.Images = images
		case string:
			if strings.TrimSpace(v) != "" {
				request.Images = []string{v}
			}
		}
	case "size":
		if s, ok := value.(string); ok {
			request.Size = s
		}
	case "type":
		request.Type = value
		if request.Metadata == nil {
			request.Metadata = map[string]interface{}{}
		}
		request.Metadata[target] = value
	case "duration":
		switch v := value.(type) {
		case float64:
			request.Duration = int(v)
		case int:
			request.Duration = v
		case string:
			var parsed int
			if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &parsed); err == nil {
				request.Duration = parsed
			}
		}
	case "seconds":
		request.Seconds = fmt.Sprint(value)
	case "input_reference":
		if s, ok := value.(string); ok {
			request.InputReference = s
		}
	default:
		if request.Metadata == nil {
			request.Metadata = map[string]interface{}{}
		}
		request.Metadata[target] = value
	}
}

func clearWorkspaceVideoMappedField(request *relaycommon.TaskSubmitReq, targetField string) {
	if request == nil {
		return
	}
	target := workspaceVideoMappedTarget(targetField)
	if target == "" {
		return
	}
	request.Type = nil
	if request.Metadata != nil {
		delete(request.Metadata, "type")
	}
	switch target {
	case "type":
	default:
		if request.Metadata != nil {
			delete(request.Metadata, target)
		}
	}
}

func workspaceVideoControlValue(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var parsed any
	if err := common.Unmarshal([]byte(value), &parsed); err == nil {
		return parsed
	}
	return value
}

func applyWorkspaceVideoMappedFields(c *gin.Context, request *relaycommon.TaskSubmitReq, rawRequest string, channel *model.WorkspaceVideoModel) error {
	if request == nil || channel == nil || strings.TrimSpace(rawRequest) == "" {
		return nil
	}
	var raw map[string]any
	if err := common.Unmarshal([]byte(rawRequest), &raw); err != nil {
		return err
	}
	controls := channel.FeatureControls
	mappings := model.NormalizeWorkspaceVideoFieldMappings(channel.FieldMappings)
	addMapped := func(enabled bool, targetField string, sourceFields ...string) {
		if !enabled {
			return
		}
		targetField = strings.TrimSpace(targetField)
		if targetField == "" {
			return
		}
		sourceFields = append(sourceFields, targetField)
		if value, ok := workspaceVideoFirstRawField(raw, sourceFields...); ok {
			setWorkspaceVideoMappedField(request, targetField, value)
		}
	}
	addMapped(controls.ReferenceImageUpload, mappings.ReferenceImage, "reference_image", "image")
	addMapped(controls.ReferenceImageUpload, mappings.ReferenceImages, "reference_images", "images")
	addMapped(controls.FirstFrameImage, mappings.FirstFrameImage, "first_frame_image", "image")
	addMapped(controls.LastFrameImage, mappings.LastFrameImage, "last_frame_image")
	clearWorkspaceVideoMappedField(request, mappings.Type)
	if controls.TypeControl {
		setWorkspaceVideoMappedField(request, mappings.Type, workspaceVideoControlValue(controls.TypeValue))
	}
	addMapped(controls.ResolutionControl, mappings.Resolution, "resolution", "size")
	addMapped(controls.RatioControl, mappings.Ratio, "ratio", "aspect_ratio", "aspectRatio")
	addMapped(controls.DurationControl, mappings.Duration, "duration", "seconds")
	addMapped(controls.FrameRateControl, mappings.FrameRate, "frame_rate", "fps")
	addMapped(controls.StyleControl, mappings.Style, "style")
	addMapped(controls.QualityControl, mappings.Quality, "quality", "quality_level")
	addMapped(controls.NegativePrompt, mappings.NegativePrompt, "negative_prompt")
	addMapped(controls.AudioTrack, mappings.Audio, "audio", "audio_track", "generate_audio")
	addMapped(controls.CameraControl, mappings.CameraMovement, "camera_movement", "camera_control", "camera")
	addMapped(controls.SeedControl, mappings.Seed, "seed")
	body, err := common.Marshal(request)
	if err != nil {
		return err
	}
	oldStorage, _ := c.Get(common.KeyBodyStorage)
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		return err
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Request.Body = io.NopCloser(storage)
	c.Request.ContentLength = int64(len(body))
	if old, ok := oldStorage.(common.BodyStorage); ok {
		_ = old.Close()
	}
	return nil
}

func workspaceVideoMappedRequestHas(request relaycommon.TaskSubmitReq, fields ...string) bool {
	for _, field := range fields {
		target := workspaceVideoMappedTarget(field)
		if target == "" {
			continue
		}
		switch target {
		case "image":
			if strings.TrimSpace(request.Image) != "" {
				return true
			}
		case "images":
			if len(request.Images) > 0 {
				return true
			}
		case "size":
			if strings.TrimSpace(request.Size) != "" {
				return true
			}
		case "type":
			if request.Type != nil {
				return true
			}
		case "duration":
			if request.Duration > 0 {
				return true
			}
		case "seconds":
			if strings.TrimSpace(request.Seconds) != "" {
				return true
			}
		case "input_reference":
			if strings.TrimSpace(request.InputReference) != "" {
				return true
			}
		default:
			if workspaceVideoMetadataHas(request.Metadata, target) {
				return true
			}
		}
	}
	return false
}

func validateWorkspaceVideoGenerationRequest(request relaycommon.TaskSubmitReq) error {
	channel, err := model.GetWorkspaceVideoModel(request.Model)
	if err != nil {
		return err
	}
	controls := channel.FeatureControls
	mappings := channel.FieldMappings
	metadata := request.Metadata
	referenceMappings := []string{mappings.ReferenceImage, mappings.ReferenceImages}
	firstFrameRequestPresent := workspaceVideoMappedRequestHas(request, mappings.FirstFrameImage)
	referenceRequestPresent := workspaceVideoMappedRequestHas(request, referenceMappings...)
	imageOnlyReferenceFallback := controls.ReferenceImageUpload &&
		strings.TrimSpace(request.Image) != "" &&
		!workspaceVideoMetadataHas(metadata, "first_frame_image", "last_frame_image") &&
		len(request.Images) == 0 &&
		strings.TrimSpace(request.InputReference) == ""

	if !controls.FirstFrameImage &&
		firstFrameRequestPresent &&
		!referenceRequestPresent &&
		!imageOnlyReferenceFallback {
		return errors.New("selected video channel does not support first frame image")
	}
	if !controls.ReferenceImageUpload &&
		(len(request.Images) > 0 ||
			request.InputReference != "" ||
			workspaceVideoMetadataHas(metadata, "reference_image", "reference_images") ||
			workspaceVideoMappedRequestHas(request, mappings.ReferenceImage, mappings.ReferenceImages)) {
		return errors.New("selected video channel does not support reference image upload")
	}
	if !controls.LastFrameImage &&
		(workspaceVideoMetadataHas(metadata, "last_frame_image") ||
			workspaceVideoMappedRequestHas(request, mappings.LastFrameImage)) {
		return errors.New("selected video channel does not support last frame image")
	}
	if !controls.DurationControl &&
		(request.Duration > 0 ||
			strings.TrimSpace(request.Seconds) != "" ||
			workspaceVideoMappedRequestHas(request, mappings.Duration)) {
		return errors.New("selected video channel does not support duration control")
	}
	if !controls.RatioControl &&
		(workspaceVideoMetadataHas(metadata, "ratio", "aspect_ratio", "aspectRatio") ||
			workspaceVideoMappedRequestHas(request, mappings.Ratio)) {
		return errors.New("selected video channel does not support ratio control")
	}
	if !controls.ResolutionControl &&
		(strings.TrimSpace(request.Size) != "" ||
			workspaceVideoMetadataHas(metadata, "resolution") ||
			workspaceVideoMappedRequestHas(request, mappings.Resolution)) {
		return errors.New("selected video channel does not support resolution control")
	}
	if !controls.FrameRateControl &&
		(workspaceVideoMetadataHas(metadata, "frame_rate", "fps") ||
			workspaceVideoMappedRequestHas(request, mappings.FrameRate)) {
		return errors.New("selected video channel does not support frame rate control")
	}
	if !controls.StyleControl &&
		(workspaceVideoMetadataHas(metadata, "style") ||
			workspaceVideoMappedRequestHas(request, mappings.Style)) {
		return errors.New("selected video channel does not support style control")
	}
	if !controls.QualityControl &&
		(workspaceVideoMetadataHas(metadata, "quality", "quality_level") ||
			workspaceVideoMappedRequestHas(request, mappings.Quality)) {
		return errors.New("selected video channel does not support quality control")
	}
	if !controls.NegativePrompt &&
		(workspaceVideoMetadataHas(metadata, "negative_prompt") ||
			workspaceVideoMappedRequestHas(request, mappings.NegativePrompt)) {
		return errors.New("selected video channel does not support negative prompt")
	}
	if !controls.AudioTrack &&
		(workspaceVideoMetadataHas(metadata, "audio", "audio_track") ||
			workspaceVideoMappedRequestHas(request, mappings.Audio)) {
		return errors.New("selected video channel does not support audio track")
	}
	if !controls.CameraControl &&
		(workspaceVideoMetadataHas(metadata, "camera_control", "camera_movement", "camera") ||
			workspaceVideoMappedRequestHas(request, mappings.CameraMovement)) {
		return errors.New("selected video channel does not support camera control")
	}
	if !controls.SeedControl &&
		(workspaceVideoMetadataHas(metadata, "seed") ||
			workspaceVideoMappedRequestHas(request, mappings.Seed)) {
		return errors.New("selected video channel does not support seed control")
	}

	requestedCount := workspaceVideoMetadataNumber(metadata, "n", "count", "batch_size")
	if !controls.BatchControl && requestedCount > 1 {
		return errors.New("selected video channel does not support generation count control")
	}
	maxBatchSize := channel.MaxBatchSize
	if maxBatchSize <= 0 {
		maxBatchSize = 1
	}
	if requestedCount > float64(maxBatchSize) {
		return fmt.Errorf("generation count exceeds channel limit: max %d", maxBatchSize)
	}
	return nil
}

func GenerateWorkspaceVideo(c *gin.Context) {
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
		newAPIError = types.NewError(errors.New("access token is not supported for workspace video generation"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	videoRequest, rawRequest, err := readWorkspaceVideoGenerationRequest(c)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	videoChannel, err := model.GetWorkspaceVideoModel(videoRequest.Model)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	if err := applyWorkspaceVideoMappedFields(c, &videoRequest, rawRequest, videoChannel); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	if err := validateWorkspaceVideoGenerationRequest(videoRequest); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
	c.Set("is_playground", true)
	c.Set("workspace_source", model.TaskCenterSourceWorkspaceVideo)
	c.Request.URL.Path = "/v1/video/generations"

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, userCache.Group)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("workspace-video-%s", userCache.Group),
		Group:  userCache.Group,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	middleware.Distribute()(c)
	if c.IsAborted() {
		return
	}

	RelayTask(c)
}

func GetWorkspaceVideoTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID == "" {
		common.ApiErrorMsg(c, "task_id is required")
		return
	}
	c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
	c.Set("task_id", taskID)
	c.Request.URL.Path = "/v1/video/generations/" + taskID
	RelayTaskFetch(c)
}
