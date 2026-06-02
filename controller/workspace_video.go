package controller

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
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
	ResolutionPresets []model.WorkspaceVideoPreset        `json:"resolution_presets"`
	RatioPresets      []model.WorkspaceVideoPreset        `json:"ratio_presets"`
	DurationPresets   []model.WorkspaceVideoPreset        `json:"duration_presets"`
	FrameRatePresets  []model.WorkspaceVideoPreset        `json:"frame_rate_presets"`
	StylePresets      []model.WorkspaceVideoPreset        `json:"style_presets"`
	QualityPresets    []model.WorkspaceVideoPreset        `json:"quality_presets"`
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
		ResolutionPresets: workspaceVideoPresetsToString(req.ResolutionPresets),
		RatioPresets:      workspaceVideoPresetsToString(req.RatioPresets),
		DurationPresets:   workspaceVideoPresetsToString(req.DurationPresets),
		FrameRatePresets:  workspaceVideoPresetsToString(req.FrameRatePresets),
		StylePresets:      workspaceVideoPresetsToString(req.StylePresets),
		QualityPresets:    workspaceVideoPresetsToString(req.QualityPresets),
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
