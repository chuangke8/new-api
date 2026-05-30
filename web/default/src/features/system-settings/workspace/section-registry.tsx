/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createSectionRegistry } from '../utils/section-registry'
import { WorkspaceChannelManager } from './workspace-channel-manager'

const WORKSPACE_SECTIONS = [
  {
    id: 'chat-channels',
    titleKey: 'Chat Channel Management',
    build: () => <WorkspaceChannelManager kind='chat' />,
  },
  {
    id: 'image-channels',
    titleKey: 'Image Channel Management',
    build: () => <WorkspaceChannelManager kind='image' />,
  },
  {
    id: 'video-channels',
    titleKey: 'Video Channel Management',
    build: () => <WorkspaceChannelManager kind='video' />,
  },
] as const

export type WorkspaceSectionId = (typeof WORKSPACE_SECTIONS)[number]['id']

const workspaceRegistry = createSectionRegistry<WorkspaceSectionId, object>({
  sections: WORKSPACE_SECTIONS,
  defaultSection: 'chat-channels',
  basePath: '/system-settings/workspace',
  urlStyle: 'path',
})

export const WORKSPACE_SECTION_IDS = workspaceRegistry.sectionIds
export const WORKSPACE_DEFAULT_SECTION = workspaceRegistry.defaultSection
export const getWorkspaceSectionNavItems =
  workspaceRegistry.getSectionNavItems
export const getWorkspaceSectionContent = workspaceRegistry.getSectionContent
export const getWorkspaceSectionMeta = workspaceRegistry.getSectionMeta

