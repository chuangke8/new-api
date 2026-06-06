package controller

import (
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type workspaceGenerationEstimateResponse struct {
	Quota       int                `json:"quota"`
	OtherRatios map[string]float64 `json:"other_ratios,omitempty"`
}

func setupWorkspaceGenerationEstimateContext(c *gin.Context, userId int, tokenNamePrefix string) error {
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return err
	}
	userCache.WriteContext(c)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, userCache.Group)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("%s-%s", tokenNamePrefix, userCache.Group),
		Group:  userCache.Group,
	}
	return middleware.SetupContextForToken(c, tempToken)
}

func estimateImageQuota(c *gin.Context, request dto.ImageRequest) (workspaceGenerationEstimateResponse, error) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, &request, nil)
	if err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}
	relayInfo.InitChannelMeta(c)

	meta := request.GetTokenCountMeta()
	tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}
	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}
	relayInfo.PriceData = priceData

	imageN := uint(1)
	if request.N != nil && *request.N > 0 {
		imageN = *request.N
	}
	if relayInfo.PriceData.UsePrice {
		relayInfo.PriceData.AddOtherRatio("n", float64(imageN))
	}

	quota := relayInfo.PriceData.QuotaToPreConsume
	if relayInfo.PriceData.FreeModel {
		quota = 0
	} else if relayInfo.PriceData.UsePrice {
		for _, ratio := range relayInfo.PriceData.OtherRatios {
			quota = int(math.Round(float64(quota) * ratio))
		}
	} else {
		quota = int(math.Round(relayInfo.PriceData.ModelRatio * relayInfo.PriceData.GroupRatioInfo.GroupRatio))
		if quota == 0 && relayInfo.PriceData.ModelRatio > 0 && relayInfo.PriceData.GroupRatioInfo.GroupRatio > 0 {
			quota = 1
		}
	}

	return workspaceGenerationEstimateResponse{
		Quota:       quota,
		OtherRatios: relayInfo.PriceData.OtherRatios,
	}, nil
}

func EstimateWorkspaceImageGeneration(c *gin.Context) {
	if c.GetBool("use_access_token") {
		common.ApiError(c, errors.New("access token is not supported for workspace image generation"))
		return
	}

	imageRequest, rawRequest, err := readWorkspaceImageGenerationRequest(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	imageChannel, err := validateWorkspaceImageGenerationRequest(imageRequest)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	applyWorkspaceImageMappedFields(c, &imageRequest, rawRequest, imageChannel)
	if mappedBody, err := common.Marshal(imageRequest); err == nil {
		if storage, storageErr := common.CreateBodyStorage(mappedBody); storageErr == nil {
			c.Set(common.KeyBodyStorage, storage)
			c.Request.Body = io.NopCloser(storage)
		}
	}

	c.Set("relay_mode", relayconstant.RelayModeImagesGenerations)
	c.Request.URL.Path = "/pg/images/generations"

	userId := c.GetInt("id")
	if err := setupWorkspaceGenerationEstimateContext(c, userId, "workspace-image-estimate"); err != nil {
		common.ApiError(c, err)
		return
	}

	middleware.Distribute()(c)
	if c.IsAborted() {
		return
	}

	estimate, err := estimateImageQuota(c, imageRequest)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, estimate)
}

func estimateVideoQuota(c *gin.Context) (workspaceGenerationEstimateResponse, error) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}
	relayInfo.InitChannelMeta(c)

	platform := constant.TaskPlatform(c.GetString("platform"))
	if platform == "" {
		platform = relay.GetTaskPlatform(c)
	}
	adaptor := relay.GetTaskAdaptor(platform)
	if adaptor == nil {
		return workspaceGenerationEstimateResponse{}, fmt.Errorf("invalid api platform: %s", platform)
	}
	adaptor.Init(relayInfo)
	if taskErr := adaptor.ValidateRequestAndSetAction(c, relayInfo); taskErr != nil {
		if taskErr.Error == nil {
			return workspaceGenerationEstimateResponse{}, errors.New(taskErr.Message)
		}
		return workspaceGenerationEstimateResponse{}, taskErr.Error
	}

	modelName := relayInfo.OriginModelName
	if modelName == "" {
		modelName = service.CoverTaskActionToModelName(platform, relayInfo.Action)
	}
	relayInfo.OriginModelName = modelName
	relayInfo.UpstreamModelName = modelName
	if err := helper.ModelMappedHelper(c, relayInfo, nil); err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}

	relayInfo.OriginModelName = modelName
	priceData, err := helper.ModelPriceHelperPerCall(c, relayInfo)
	if err != nil {
		return workspaceGenerationEstimateResponse{}, err
	}
	relayInfo.PriceData = priceData

	if estimatedRatios := adaptor.EstimateBilling(c, relayInfo); len(estimatedRatios) > 0 {
		for key, ratio := range estimatedRatios {
			relayInfo.PriceData.AddOtherRatio(key, ratio)
		}
	}

	quota := relayInfo.PriceData.Quota
	if relayInfo.PriceData.FreeModel {
		quota = 0
	} else if !common.StringsContains(constant.TaskPricePatches, modelName) {
		for _, ratio := range relayInfo.PriceData.OtherRatios {
			if ratio != 1.0 {
				quota = int(float64(quota) * ratio)
			}
		}
	}

	return workspaceGenerationEstimateResponse{
		Quota:       quota,
		OtherRatios: relayInfo.PriceData.OtherRatios,
	}, nil
}

func EstimateWorkspaceVideoGeneration(c *gin.Context) {
	if c.GetBool("use_access_token") {
		common.ApiError(c, errors.New("access token is not supported for workspace video generation"))
		return
	}

	videoRequest, err := readWorkspaceVideoGenerationRequest(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateWorkspaceVideoGenerationRequest(videoRequest); err != nil {
		common.ApiError(c, err)
		return
	}

	c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
	c.Set("is_playground", true)
	c.Request.URL.Path = "/v1/video/generations"

	userId := c.GetInt("id")
	if err := setupWorkspaceGenerationEstimateContext(c, userId, "workspace-video-estimate"); err != nil {
		common.ApiError(c, err)
		return
	}

	middleware.Distribute()(c)
	if c.IsAborted() {
		return
	}

	estimate, err := estimateVideoQuota(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	common.ApiSuccess(c, estimate)
}
