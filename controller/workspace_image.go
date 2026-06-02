package controller

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

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

func newWorkspaceImageTaskID() string {
	key, err := common.GenerateRandomCharsKey(32)
	if err != nil || key == "" {
		key = fmt.Sprintf("%d%s", time.Now().UnixNano(), common.GetRandomString(8))
	}
	return "img_" + key
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

	c.Set("relay_mode", relayconstant.RelayModeImagesGenerations)
	c.Request.URL.Path = "/pg/images/generations"

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
		Name:   fmt.Sprintf("workspace-image-%s", userCache.Group),
		Group:  userCache.Group,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	taskID := newWorkspaceImageTaskID()
	submittedAt := time.Now().Unix()
	recorder := &workspaceImageResponseRecorder{
		ResponseWriter: c.Writer,
		body:           bytes.NewBuffer(nil),
	}
	c.Writer = recorder

	middleware.Distribute()(c)
	if c.IsAborted() {
		recordWorkspaceImageTaskCenter(c, taskID, userId, imageRequest, rawRequest, recorder.body.String(), submittedAt, recorder.Status())
		return
	}

	Relay(c, types.RelayFormatOpenAIImage)
	recordWorkspaceImageTaskCenter(c, taskID, userId, imageRequest, rawRequest, recorder.body.String(), submittedAt, recorder.Status())
}
