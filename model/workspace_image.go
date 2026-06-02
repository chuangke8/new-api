package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const defaultWorkspaceImageCategoryName = "general"
const defaultWorkspaceImageCategoryAlias = "常用"

type WorkspaceImageCategory struct {
	Id          int    `json:"id"`
	Weight      int    `json:"weight" gorm:"default:0;index"`
	Name        string `json:"name" gorm:"type:varchar(64);not null;uniqueIndex"`
	Alias       string `json:"alias" gorm:"type:varchar(128);default:''"`
	Remark      string `json:"remark" gorm:"type:varchar(255);default:''"`
	Disabled    bool   `json:"disabled" gorm:"default:false;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

type WorkspaceImageChannel struct {
	Id              int    `json:"id"`
	Weight          int    `json:"weight" gorm:"default:0;index"`
	Model           string `json:"model" gorm:"type:varchar(255);not null;uniqueIndex"`
	ModelAlias      string `json:"model_alias" gorm:"type:varchar(255);default:''"`
	CategoryId      int    `json:"category_id" gorm:"index;not null"`
	FeatureControls string `json:"feature_controls" gorm:"type:text"`
	MaxBatchSize    int    `json:"max_batch_size" gorm:"default:4"`
	SizePresets     string `json:"size_presets" gorm:"type:text"`
	RatioPresets    string `json:"ratio_presets" gorm:"type:text"`
	StylePresets    string `json:"style_presets" gorm:"type:text"`
	QualityPresets  string `json:"quality_presets" gorm:"type:text"`
	Disabled        bool   `json:"disabled" gorm:"default:false;index"`
	Remark          string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedTime     int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime     int64  `json:"updated_time" gorm:"bigint"`

	Category *WorkspaceImageCategory `json:"category,omitempty" gorm:"foreignKey:CategoryId"`
}

type WorkspaceImagePreset struct {
	Value    string `json:"value"`
	LabelZh  string `json:"label_zh"`
	LabelEn  string `json:"label_en"`
	Disabled bool   `json:"disabled"`
}

type WorkspaceImageFeatureControls struct {
	ReferenceImageUpload bool `json:"reference_image_upload"`
	SizeControl          bool `json:"size_control"`
	RatioControl         bool `json:"ratio_control"`
	StyleControl         bool `json:"style_control"`
	QualityControl       bool `json:"quality_control"`
	NegativePrompt       bool `json:"negative_prompt"`
	SeedControl          bool `json:"seed_control"`
	BatchControl         bool `json:"batch_control"`
}

type WorkspaceImageModel struct {
	Id              int                           `json:"id"`
	Model           string                        `json:"model"`
	ModelAlias      string                        `json:"model_alias"`
	DisplayName     string                        `json:"display_name"`
	CategoryId      int                           `json:"category_id"`
	CategoryName    string                        `json:"category_name"`
	CategoryAlias   string                        `json:"category_alias"`
	CategoryDisplay string                        `json:"category_display"`
	FeatureControls WorkspaceImageFeatureControls `json:"feature_controls"`
	MaxBatchSize    int                           `json:"max_batch_size"`
	SizePresets     []WorkspaceImagePreset        `json:"size_presets"`
	RatioPresets    []WorkspaceImagePreset        `json:"ratio_presets"`
	StylePresets    []WorkspaceImagePreset        `json:"style_presets"`
	QualityPresets  []WorkspaceImagePreset        `json:"quality_presets"`
}

func defaultWorkspaceImageFeatureControls() WorkspaceImageFeatureControls {
	return WorkspaceImageFeatureControls{
		ReferenceImageUpload: true,
		SizeControl:          true,
		RatioControl:         true,
		StyleControl:         true,
		QualityControl:       true,
		NegativePrompt:       true,
		SeedControl:          true,
		BatchControl:         true,
	}
}

func workspaceImagePresetsToString(presets []WorkspaceImagePreset) string {
	clean := make([]WorkspaceImagePreset, 0, len(presets))
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

func workspaceImagePresetsFromString(value string) []WorkspaceImagePreset {
	var presets []WorkspaceImagePreset
	if strings.TrimSpace(value) == "" {
		return presets
	}
	if err := common.UnmarshalJsonStr(value, &presets); err != nil {
		return []WorkspaceImagePreset{}
	}
	return presets
}

func workspaceImageFeatureControlsToString(controls WorkspaceImageFeatureControls) string {
	b, err := common.Marshal(controls)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func workspaceImageFeatureControlsFromString(value string) WorkspaceImageFeatureControls {
	controls := defaultWorkspaceImageFeatureControls()
	if strings.TrimSpace(value) == "" {
		return controls
	}
	_ = common.UnmarshalJsonStr(value, &controls)
	return controls
}

func EnsureDefaultWorkspaceImageCategory() (*WorkspaceImageCategory, error) {
	var count int64
	if err := DB.Model(&WorkspaceImageCategory{}).Count(&count).Error; err != nil {
		return nil, err
	}
	if count == 0 {
		now := common.GetTimestamp()
		category := WorkspaceImageCategory{
			Weight:      100,
			Name:        defaultWorkspaceImageCategoryName,
			Alias:       defaultWorkspaceImageCategoryAlias,
			Disabled:    false,
			CreatedTime: now,
			UpdatedTime: now,
		}
		if err := DB.Create(&category).Error; err != nil {
			return nil, err
		}
		return &category, nil
	}
	var category WorkspaceImageCategory
	if err := DB.Order("weight DESC").Order("id ASC").First(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func GetWorkspaceImageCategories() ([]WorkspaceImageCategory, error) {
	if _, err := EnsureDefaultWorkspaceImageCategory(); err != nil {
		return nil, err
	}
	var categories []WorkspaceImageCategory
	err := DB.Order("weight DESC").Order("id ASC").Find(&categories).Error
	return categories, err
}

func CreateWorkspaceImageCategory(category *WorkspaceImageCategory) error {
	now := common.GetTimestamp()
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.CreatedTime = now
	category.UpdatedTime = now
	return DB.Create(category).Error
}

func UpdateWorkspaceImageCategory(category *WorkspaceImageCategory) error {
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceImageCategory{}).Where("id = ?", category.Id).Updates(map[string]interface{}{
		"weight":       category.Weight,
		"name":         category.Name,
		"alias":        category.Alias,
		"remark":       category.Remark,
		"disabled":     category.Disabled,
		"updated_time": category.UpdatedTime,
	}).Error
}

func DeleteWorkspaceImageCategory(id int) error {
	var count int64
	if err := DB.Model(&WorkspaceImageCategory{}).Count(&count).Error; err != nil {
		return err
	}
	if count <= 1 {
		return errors.New("at least one category must remain")
	}
	var used int64
	if err := DB.Model(&WorkspaceImageChannel{}).Where("category_id = ?", id).Count(&used).Error; err != nil {
		return err
	}
	if used > 0 {
		return errors.New("category is used by channels, please adjust channels first")
	}
	return DB.Delete(&WorkspaceImageCategory{}, id).Error
}

func GetWorkspaceImageChannels() ([]WorkspaceImageChannel, error) {
	if _, err := EnsureDefaultWorkspaceImageCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceImageChannel
	err := DB.Preload("Category").Order("weight DESC").Order("id ASC").Find(&channels).Error
	return channels, err
}

func CreateWorkspaceImageChannel(channel *WorkspaceImageChannel) error {
	now := common.GetTimestamp()
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	if channel.MaxBatchSize <= 0 {
		channel.MaxBatchSize = 4
	}
	channel.CreatedTime = now
	channel.UpdatedTime = now
	if strings.TrimSpace(channel.FeatureControls) == "" {
		channel.FeatureControls = workspaceImageFeatureControlsToString(defaultWorkspaceImageFeatureControls())
	}
	return DB.Create(channel).Error
}

func UpdateWorkspaceImageChannel(channel *WorkspaceImageChannel) error {
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	if channel.MaxBatchSize <= 0 {
		channel.MaxBatchSize = 4
	}
	channel.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceImageChannel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"weight":           channel.Weight,
		"model":            channel.Model,
		"model_alias":      channel.ModelAlias,
		"category_id":      channel.CategoryId,
		"feature_controls": channel.FeatureControls,
		"max_batch_size":   channel.MaxBatchSize,
		"size_presets":     channel.SizePresets,
		"ratio_presets":    channel.RatioPresets,
		"style_presets":    channel.StylePresets,
		"quality_presets":  channel.QualityPresets,
		"disabled":         channel.Disabled,
		"remark":           channel.Remark,
		"updated_time":     channel.UpdatedTime,
	}).Error
}

func DeleteWorkspaceImageChannel(id int) error {
	return DB.Delete(&WorkspaceImageChannel{}, id).Error
}

func workspaceImageChannelToModel(channel WorkspaceImageChannel) WorkspaceImageModel {
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
		maxBatchSize = 4
	}
	return WorkspaceImageModel{
		Id:              channel.Id,
		Model:           channel.Model,
		ModelAlias:      channel.ModelAlias,
		DisplayName:     displayName,
		CategoryId:      channel.CategoryId,
		CategoryName:    categoryName,
		CategoryAlias:   categoryAlias,
		CategoryDisplay: categoryDisplay,
		FeatureControls: workspaceImageFeatureControlsFromString(channel.FeatureControls),
		MaxBatchSize:    maxBatchSize,
		SizePresets:     workspaceImagePresetsFromString(channel.SizePresets),
		RatioPresets:    workspaceImagePresetsFromString(channel.RatioPresets),
		StylePresets:    workspaceImagePresetsFromString(channel.StylePresets),
		QualityPresets:  workspaceImagePresetsFromString(channel.QualityPresets),
	}
}

func GetWorkspaceImageModels() ([]WorkspaceImageModel, error) {
	if _, err := EnsureDefaultWorkspaceImageCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceImageChannel
	err := DB.Preload("Category").
		Where("workspace_image_channels.disabled = ?", false).
		Order("workspace_image_channels.weight DESC").
		Order("workspace_image_channels.id ASC").
		Find(&channels).Error
	if err != nil {
		return nil, err
	}
	models := make([]WorkspaceImageModel, 0, len(channels))
	for _, channel := range channels {
		if channel.Category != nil && channel.Category.Disabled {
			continue
		}
		models = append(models, workspaceImageChannelToModel(channel))
	}
	return models, nil
}

func GetWorkspaceImageModel(modelName string) (*WorkspaceImageModel, error) {
	var channel WorkspaceImageChannel
	if err := DB.Preload("Category").
		Where("model = ? AND disabled = ?", strings.TrimSpace(modelName), false).
		First(&channel).Error; err != nil {
		return nil, err
	}
	if channel.Category != nil && channel.Category.Disabled {
		return nil, errors.New("category is disabled")
	}
	model := workspaceImageChannelToModel(channel)
	return &model, nil
}

func GetWorkspaceImageAvailableModels() []string {
	return GetWorkspaceChatAvailableModels()
}

func EnsureWorkspaceImageCategoryExists(categoryId int) error {
	var count int64
	if err := DB.Model(&WorkspaceImageCategory{}).Where("id = ?", categoryId).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("category not found")
	}
	return nil
}

func EnsureWorkspaceImageModelAvailable(modelName string) error {
	return EnsureWorkspaceChatModelAvailable(modelName)
}
