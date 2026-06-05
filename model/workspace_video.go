package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const defaultWorkspaceVideoCategoryName = "general"
const defaultWorkspaceVideoCategoryAlias = "常用"

type WorkspaceVideoCategory struct {
	Id          int    `json:"id"`
	Weight      int    `json:"weight" gorm:"default:0;index"`
	Name        string `json:"name" gorm:"type:varchar(64);not null;uniqueIndex"`
	Alias       string `json:"alias" gorm:"type:varchar(128);default:''"`
	Remark      string `json:"remark" gorm:"type:varchar(255);default:''"`
	Disabled    bool   `json:"disabled" gorm:"default:false;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

type WorkspaceVideoChannel struct {
	Id                int    `json:"id"`
	Weight            int    `json:"weight" gorm:"default:0;index"`
	Model             string `json:"model" gorm:"type:varchar(255);not null;uniqueIndex"`
	ModelAlias        string `json:"model_alias" gorm:"type:varchar(255);default:''"`
	CategoryId        int    `json:"category_id" gorm:"index;not null"`
	FeatureControls   string `json:"feature_controls" gorm:"type:text"`
	MaxBatchSize      int    `json:"max_batch_size" gorm:"default:1"`
	ResolutionPresets string `json:"resolution_presets" gorm:"type:text"`
	RatioPresets      string `json:"ratio_presets" gorm:"type:text"`
	DurationPresets   string `json:"duration_presets" gorm:"type:text"`
	FrameRatePresets  string `json:"frame_rate_presets" gorm:"type:text"`
	StylePresets      string `json:"style_presets" gorm:"type:text"`
	QualityPresets    string `json:"quality_presets" gorm:"type:text"`
	Disabled          bool   `json:"disabled" gorm:"default:false;index"`
	Remark            string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedTime       int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime       int64  `json:"updated_time" gorm:"bigint"`

	Category *WorkspaceVideoCategory `json:"category,omitempty" gorm:"foreignKey:CategoryId"`
}

type WorkspaceVideoPreset struct {
	Value    string `json:"value"`
	LabelZh  string `json:"label_zh"`
	LabelEn  string `json:"label_en"`
	Disabled bool   `json:"disabled"`
}

type WorkspaceVideoFeatureControls struct {
	FirstFrameImage      bool `json:"first_frame_image"`
	LastFrameImage       bool `json:"last_frame_image"`
	ReferenceImageUpload bool `json:"reference_image_upload"`
	DurationControl      bool `json:"duration_control"`
	RatioControl         bool `json:"ratio_control"`
	ResolutionControl    bool `json:"resolution_control"`
	FrameRateControl     bool `json:"frame_rate_control"`
	StyleControl         bool `json:"style_control"`
	QualityControl       bool `json:"quality_control"`
	NegativePrompt       bool `json:"negative_prompt"`
	AudioTrack           bool `json:"audio_track"`
	CameraControl        bool `json:"camera_control"`
	SeedControl          bool `json:"seed_control"`
	BatchControl         bool `json:"batch_control"`
}

type WorkspaceVideoModel struct {
	Id                int                           `json:"id"`
	Model             string                        `json:"model"`
	ModelAlias        string                        `json:"model_alias"`
	DisplayName       string                        `json:"display_name"`
	CategoryId        int                           `json:"category_id"`
	CategoryName      string                        `json:"category_name"`
	CategoryAlias     string                        `json:"category_alias"`
	CategoryDisplay   string                        `json:"category_display"`
	FeatureControls   WorkspaceVideoFeatureControls `json:"feature_controls"`
	MaxBatchSize      int                           `json:"max_batch_size"`
	ResolutionPresets []WorkspaceVideoPreset        `json:"resolution_presets"`
	RatioPresets      []WorkspaceVideoPreset        `json:"ratio_presets"`
	DurationPresets   []WorkspaceVideoPreset        `json:"duration_presets"`
	FrameRatePresets  []WorkspaceVideoPreset        `json:"frame_rate_presets"`
	StylePresets      []WorkspaceVideoPreset        `json:"style_presets"`
	QualityPresets    []WorkspaceVideoPreset        `json:"quality_presets"`
}

func defaultWorkspaceVideoFeatureControls() WorkspaceVideoFeatureControls {
	return WorkspaceVideoFeatureControls{
		FirstFrameImage:      true,
		LastFrameImage:       true,
		ReferenceImageUpload: true,
		DurationControl:      true,
		RatioControl:         true,
		ResolutionControl:    true,
		FrameRateControl:     true,
		StyleControl:         true,
		QualityControl:       true,
		NegativePrompt:       true,
		AudioTrack:           true,
		CameraControl:        true,
		SeedControl:          true,
		BatchControl:         true,
	}
}

func workspaceVideoPresetsToString(presets []WorkspaceVideoPreset) string {
	clean := make([]WorkspaceVideoPreset, 0, len(presets))
	seen := map[string]bool{}
	for _, preset := range presets {
		preset.Value = strings.TrimSpace(preset.Value)
		preset.LabelZh = strings.TrimSpace(preset.LabelZh)
		preset.LabelEn = strings.TrimSpace(preset.LabelEn)
		if preset.Value == "" || seen[preset.Value] {
			continue
		}
		seen[preset.Value] = true
		clean = append(clean, preset)
	}
	b, err := common.Marshal(clean)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func workspaceVideoPresetsFromString(value string) []WorkspaceVideoPreset {
	var presets []WorkspaceVideoPreset
	if strings.TrimSpace(value) == "" {
		return presets
	}
	if err := common.UnmarshalJsonStr(value, &presets); err != nil {
		return []WorkspaceVideoPreset{}
	}
	return presets
}

func workspaceVideoFeatureControlsToString(controls WorkspaceVideoFeatureControls) string {
	b, err := common.Marshal(controls)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func workspaceVideoFeatureControlsFromString(value string) WorkspaceVideoFeatureControls {
	controls := defaultWorkspaceVideoFeatureControls()
	if strings.TrimSpace(value) == "" {
		return controls
	}
	_ = common.UnmarshalJsonStr(value, &controls)
	return controls
}

func EnsureDefaultWorkspaceVideoCategory() (*WorkspaceVideoCategory, error) {
	var category WorkspaceVideoCategory
	err := DB.Where("name = ?", defaultWorkspaceVideoCategoryName).First(&category).Error
	if err == nil {
		return &category, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := common.GetTimestamp()
	category = WorkspaceVideoCategory{
		Weight:      100,
		Name:        defaultWorkspaceVideoCategoryName,
		Alias:       defaultWorkspaceVideoCategoryAlias,
		Disabled:    false,
		CreatedTime: now,
		UpdatedTime: now,
	}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&category).Error; err != nil {
		return nil, err
	}
	if category.Id != 0 {
		return &category, nil
	}
	if err := DB.Where("name = ?", defaultWorkspaceVideoCategoryName).First(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func GetWorkspaceVideoCategories() ([]WorkspaceVideoCategory, error) {
	if _, err := EnsureDefaultWorkspaceVideoCategory(); err != nil {
		return nil, err
	}
	var categories []WorkspaceVideoCategory
	err := DB.Order("weight DESC").Order("id ASC").Find(&categories).Error
	return categories, err
}

func CreateWorkspaceVideoCategory(category *WorkspaceVideoCategory) error {
	now := common.GetTimestamp()
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.CreatedTime = now
	category.UpdatedTime = now
	return DB.Create(category).Error
}

func UpdateWorkspaceVideoCategory(category *WorkspaceVideoCategory) error {
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceVideoCategory{}).Where("id = ?", category.Id).Updates(map[string]interface{}{
		"weight":       category.Weight,
		"name":         category.Name,
		"alias":        category.Alias,
		"remark":       category.Remark,
		"disabled":     category.Disabled,
		"updated_time": category.UpdatedTime,
	}).Error
}

func DeleteWorkspaceVideoCategory(id int) error {
	var count int64
	if err := DB.Model(&WorkspaceVideoCategory{}).Count(&count).Error; err != nil {
		return err
	}
	if count <= 1 {
		return errors.New("at least one category must remain")
	}
	var used int64
	if err := DB.Model(&WorkspaceVideoChannel{}).Where("category_id = ?", id).Count(&used).Error; err != nil {
		return err
	}
	if used > 0 {
		return errors.New("category is used by channels, please adjust channels first")
	}
	return DB.Delete(&WorkspaceVideoCategory{}, id).Error
}

func GetWorkspaceVideoChannels() ([]WorkspaceVideoChannel, error) {
	if _, err := EnsureDefaultWorkspaceVideoCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceVideoChannel
	err := DB.Preload("Category").Order("weight DESC").Order("id ASC").Find(&channels).Error
	return channels, err
}

func CreateWorkspaceVideoChannel(channel *WorkspaceVideoChannel) error {
	now := common.GetTimestamp()
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	if channel.MaxBatchSize <= 0 {
		channel.MaxBatchSize = 1
	}
	channel.CreatedTime = now
	channel.UpdatedTime = now
	if strings.TrimSpace(channel.FeatureControls) == "" {
		channel.FeatureControls = workspaceVideoFeatureControlsToString(defaultWorkspaceVideoFeatureControls())
	}
	return DB.Create(channel).Error
}

func UpdateWorkspaceVideoChannel(channel *WorkspaceVideoChannel) error {
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	if channel.MaxBatchSize <= 0 {
		channel.MaxBatchSize = 1
	}
	channel.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceVideoChannel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"weight":             channel.Weight,
		"model":              channel.Model,
		"model_alias":        channel.ModelAlias,
		"category_id":        channel.CategoryId,
		"feature_controls":   channel.FeatureControls,
		"max_batch_size":     channel.MaxBatchSize,
		"resolution_presets": channel.ResolutionPresets,
		"ratio_presets":      channel.RatioPresets,
		"duration_presets":   channel.DurationPresets,
		"frame_rate_presets": channel.FrameRatePresets,
		"style_presets":      channel.StylePresets,
		"quality_presets":    channel.QualityPresets,
		"disabled":           channel.Disabled,
		"remark":             channel.Remark,
		"updated_time":       channel.UpdatedTime,
	}).Error
}

func DeleteWorkspaceVideoChannel(id int) error {
	return DB.Delete(&WorkspaceVideoChannel{}, id).Error
}

func workspaceVideoChannelToModel(channel WorkspaceVideoChannel) WorkspaceVideoModel {
	displayName := channel.ModelAlias
	if displayName == "" {
		displayName = channel.Model
	}
	categoryName := ""
	categoryAlias := ""
	categoryDisplay := ""
	if channel.Category != nil {
		categoryName = channel.Category.Name
		categoryAlias = channel.Category.Alias
		categoryDisplay = categoryAlias
		if categoryDisplay == "" {
			categoryDisplay = categoryName
		}
	}
	maxBatchSize := channel.MaxBatchSize
	if maxBatchSize <= 0 {
		maxBatchSize = 1
	}
	return WorkspaceVideoModel{
		Id:                channel.Id,
		Model:             channel.Model,
		ModelAlias:        channel.ModelAlias,
		DisplayName:       displayName,
		CategoryId:        channel.CategoryId,
		CategoryName:      categoryName,
		CategoryAlias:     categoryAlias,
		CategoryDisplay:   categoryDisplay,
		FeatureControls:   workspaceVideoFeatureControlsFromString(channel.FeatureControls),
		MaxBatchSize:      maxBatchSize,
		ResolutionPresets: workspaceVideoPresetsFromString(channel.ResolutionPresets),
		RatioPresets:      workspaceVideoPresetsFromString(channel.RatioPresets),
		DurationPresets:   workspaceVideoPresetsFromString(channel.DurationPresets),
		FrameRatePresets:  workspaceVideoPresetsFromString(channel.FrameRatePresets),
		StylePresets:      workspaceVideoPresetsFromString(channel.StylePresets),
		QualityPresets:    workspaceVideoPresetsFromString(channel.QualityPresets),
	}
}

func GetWorkspaceVideoModels() ([]WorkspaceVideoModel, error) {
	if _, err := EnsureDefaultWorkspaceVideoCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceVideoChannel
	err := DB.Preload("Category").
		Where("workspace_video_channels.disabled = ?", false).
		Order("workspace_video_channels.weight DESC").
		Order("workspace_video_channels.id ASC").
		Find(&channels).Error
	if err != nil {
		return nil, err
	}
	models := make([]WorkspaceVideoModel, 0, len(channels))
	for _, channel := range channels {
		if channel.Category != nil && channel.Category.Disabled {
			continue
		}
		models = append(models, workspaceVideoChannelToModel(channel))
	}
	return models, nil
}

func GetWorkspaceVideoModel(modelName string) (*WorkspaceVideoModel, error) {
	var channel WorkspaceVideoChannel
	if err := DB.Preload("Category").
		Where("model = ? AND disabled = ?", strings.TrimSpace(modelName), false).
		First(&channel).Error; err != nil {
		return nil, err
	}
	if channel.Category != nil && channel.Category.Disabled {
		return nil, errors.New("category is disabled")
	}
	model := workspaceVideoChannelToModel(channel)
	return &model, nil
}

func GetWorkspaceVideoAvailableModels() []string {
	return GetWorkspaceChatAvailableModels()
}

func EnsureWorkspaceVideoCategoryExists(categoryId int) error {
	var count int64
	if err := DB.Model(&WorkspaceVideoCategory{}).Where("id = ?", categoryId).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("category not found")
	}
	return nil
}

func EnsureWorkspaceVideoModelAvailable(modelName string) error {
	return EnsureWorkspaceChatModelAvailable(modelName)
}
