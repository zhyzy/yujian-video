<template>
  <div class="material-library">
    <main class="library-shell">
      <aside class="folder-pane">
        <div class="pane-head">
          <div>
            <strong>文件夹树</strong>
            <span>按项目、城市或日期整理素材</span>
          </div>
          <div class="pane-actions">
            <button class="pane-action-btn" :disabled="!canCreateInCurrent" @click="createNextDateFolder" title="新增日期文件夹">
              <el-icon><Calendar /></el-icon>
              日期
            </button>
            <button class="pane-action-btn" :disabled="!canCreateRootOrSiblingFolder" @click="openSiblingFolderDialog()" :title="isRootFolder(currentFolder) ? '在文件树顶级新建文件夹' : '在当前目录旁边新建同级文件夹'">
              <el-icon><Collection /></el-icon>
              {{ isRootFolder(currentFolder) ? '顶级' : '同级' }}
            </button>
            <button class="pane-action-btn" :disabled="!canCreateInCurrent" @click="openFolderDialog()" title="新建子级文件夹">
              <el-icon><Plus /></el-icon>
              子级
            </button>
          </div>
        </div>

        <div class="folder-finder">
          <div class="folder-search-box">
            <el-icon><Search /></el-icon>
            <input v-model="folderSearch" placeholder="搜索文件夹/城市/日期" />
            <button v-if="folderSearch" type="button" @click="folderSearch = ''">清空</button>
          </div>
          <div v-if="folderSearch" class="folder-search-results">
            <button
              v-for="folder in folderSearchResults"
              :key="folder.id"
              type="button"
              @click="selectFolder(folder)"
            >
              <strong>{{ folder.name }}</strong>
              <span>{{ folder.path }}</span>
            </button>
            <div v-if="!folderSearchResults.length" class="folder-search-empty">没有匹配的文件夹</div>
          </div>
        </div>

        <div class="tree-wrap" v-loading="treeLoading" @contextmenu.prevent="openBlankFolderContextMenu">
          <el-tree
            v-if="folderTree"
            ref="treeRef"
            :data="folderTreeRoots"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            :default-expanded-keys="expandedFolderKeys"
            :current-node-key="currentFolderId"
            highlight-current
            @node-click="selectFolder"
          >
            <template #default="{ data }">
              <div
                class="tree-node"
                :class="{ droppable: canUploadToFolder(data) }"
                @contextmenu.prevent.stop="openFolderContextMenu($event, data)"
                @dragover.prevent.stop
                @drop.prevent.stop="handleFolderDrop($event, data)"
              >
                <el-icon><FolderOpened /></el-icon>
                <span class="tree-name">{{ data.name }}</span>
                <em :title="`${data.folder_count || 0} 个下级文件夹，${data.file_count || 0} 个文件`">{{ data.file_count || 0 }}</em>
                <span class="tree-actions" @click.stop>
                  <button v-if="canCreateFolderIn(data)" title="新增子文件夹" @click="openFolderDialog(null, data)">
                    <el-icon><Plus /></el-icon>
                  </button>
                  <button v-if="canCreateSiblingFor(data)" title="新增同级文件夹" @click="openSiblingFolderDialog(data)">
                    <el-icon><Collection /></el-icon>
                  </button>
                  <button v-if="!isSystemFolder(data)" title="重命名" @click="openFolderDialog(data)">
                    <el-icon><EditPen /></el-icon>
                  </button>
                  <button v-if="!isSystemFolder(data)" class="danger" title="删除" @click="removeFolder(data)">
                    <el-icon><Delete /></el-icon>
                  </button>
                </span>
              </div>
            </template>
          </el-tree>
          <div v-else class="tree-empty">正在准备目录</div>
        </div>

        <div
          v-if="folderContextMenu.visible"
          class="folder-context-menu"
          :style="{ left: `${folderContextMenu.x}px`, top: `${folderContextMenu.y}px` }"
          @click.stop
          @contextmenu.prevent
        >
          <button v-if="canCreateFolderIn(folderContextMenu.folder) && !isTreeRoot(folderContextMenu.folder)" type="button" @click="runFolderContextAction('child')">
            <el-icon><Plus /></el-icon>
            新建子级
          </button>
          <button v-if="canCreateSiblingFor(folderContextMenu.folder)" type="button" @click="runFolderContextAction('sibling')">
            <el-icon><Collection /></el-icon>
            {{ isTreeRoot(folderContextMenu.folder) || isRootFolder(folderContextMenu.folder) ? '新建顶级' : '新建同级' }}
          </button>
          <button v-if="!isSystemFolder(folderContextMenu.folder)" type="button" @click="runFolderContextAction('rename')">
            <el-icon><EditPen /></el-icon>
            重命名
          </button>
          <button v-if="!isSystemFolder(folderContextMenu.folder)" class="danger" type="button" @click="runFolderContextAction('delete')">
            <el-icon><Delete /></el-icon>
            删除
          </button>
        </div>
      </aside>

      <section class="content-pane">
        <div class="pathbar">
          <div class="breadcrumbs">
            <button
              v-for="crumb in breadcrumbs"
              :key="crumb.id"
              :class="{ active: crumb.id === currentFolderId }"
              @click="selectFolder(crumb)"
            >
              {{ crumb.name }}
            </button>
          </div>
          <div class="storage-pills">
            <span class="path-pill" :title="currentFolder?.path || '/'">{{ currentFolder?.path || '/' }}</span>
            <span>文件夹 <b>{{ childFolders.length }}</b></span>
            <span>当前文件 <b>{{ currentDirectFileCount }}</b></span>
            <span>下级 <b>{{ currentTotalFileCount }}</b></span>
            <span>容量 <b>{{ totalSizeHuman }}</b></span>
          </div>
          <div class="content-tools">
            <div class="search-box">
              <el-icon><Search /></el-icon>
              <input v-model="keyword" placeholder="搜索当前目录" />
            </div>
            <button class="tool-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="网格视图">
              <el-icon><Grid /></el-icon>
            </button>
            <button class="tool-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="列表视图">
              <el-icon><Tickets /></el-icon>
            </button>
            <button class="tool-btn" :class="{ active: detailDrawerVisible }" @click="detailDrawerVisible = true" title="目录与文件详情">
              <el-icon><View /></el-icon>
            </button>
          </div>
        </div>

        <section class="upload-stat-panel compact">
          <div class="upload-stat-head">
            <div>
              <strong>上传责任统计</strong>
              <span>{{ uploadStatsDateRange }} · 视频 {{ uploadStatsTotal.video_count }} 个 · 文件 {{ uploadStatsTotal.total_count }} 个</span>
            </div>
            <div class="upload-stat-controls">
              <input v-model="uploadStatsMonth" class="month-input" type="month" @change="loadUploadStats" />
              <el-select v-model="uploaderFilter" clearable filterable placeholder="筛选上传人" style="width: 150px" @change="loadFiles">
                <el-option
                  v-for="person in uploaderOptions"
                  :key="person.uploader_id"
                  :label="person.uploader_name"
                  :value="person.uploader_id"
                />
              </el-select>
            </div>
          </div>
          <div v-if="uploadStatsRows.length" class="upload-stat-list">
            <button
              v-for="person in uploadStatsRows"
              :key="person.uploader_id"
              class="upload-stat-card"
              :class="{ active: uploaderFilter === person.uploader_id }"
              @click="toggleUploaderFilter(person)"
            >
              <span>{{ person.uploader_name }}</span>
              <strong>{{ person.video_count }}</strong>
              <em>共 {{ person.total_count }} 个</em>
            </button>
          </div>
          <div v-else class="upload-stat-empty">当前月份暂无上传记录</div>
        </section>

        <div
          v-loading="filesLoading"
          ref="dropSurfaceRef"
          class="drop-surface"
          :class="{ dragging: isDragging, disabled: !canUploadToCurrent }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="materialAccept"
            class="hidden-input"
            @change="handleFilePick"
          />

          <div class="content-head">
            <div>
              <strong>{{ currentFolder?.name || '我的素材' }}</strong>
              <span>{{ uploadPathPreview }}</span>
            </div>
            <div class="content-head-actions">
              <div class="selection-bar">
                <button class="select-btn" :class="{ active: selectionMode }" :disabled="!visibleItemCount" @click="toggleSelectionMode">
                  <el-icon><Check /></el-icon>
                  {{ selectionMode ? '退出选择' : '选择' }}
                </button>
                <template v-if="selectionMode">
                  <button class="select-btn" :class="{ active: isAllVisibleSelected }" :disabled="!visibleItemCount" @click="toggleSelectAllVisible">
                    {{ isAllVisibleSelected ? '取消全选' : '全选' }}
                  </button>
                  <button class="select-btn" :disabled="!selectedItemCount" @click="clearSelection">清空</button>
                  <span>已选 {{ selectedItemCount }}</span>
                </template>
                <button v-if="selectionMode" class="select-btn" :disabled="!selectedFiles.length" @click="shareSelectedFiles">
                  <el-icon><Share /></el-icon>
                  合并分享
                </button>
                <button v-if="selectionMode" class="select-btn" :disabled="!selectedFiles.length" @click="downloadSelectedFiles">
                  <el-icon><Download /></el-icon>
                  批量下载
                </button>
                <button v-if="selectionMode" class="select-btn" :disabled="!selectedFiles.length" @click="openMoveDialog(selectedFiles)">
                  <el-icon><Folder /></el-icon>
                  批量移动
                </button>
                <button v-if="selectionMode" class="select-btn danger" :disabled="!selectedItemCount" @click="removeSelectedItems">
                  <el-icon><Delete /></el-icon>
                  批量删除
                </button>
              </div>
              <div class="sort-tabs">
                <button :class="{ active: sortMode === 'time' }" @click="sortMode = 'time'">时间</button>
                <button :class="{ active: sortMode === 'name' }" @click="sortMode = 'name'">名称</button>
                <button :class="{ active: sortMode === 'size' }" @click="sortMode = 'size'">大小</button>
              </div>
              <div v-if="canBindCurrentFolder" class="folder-bind-inline">
                <span v-if="boundCityNames.length" :title="boundCityNames.join('、')">已绑 {{ boundCityNames.join('、') }}</span>
                <span v-else>未绑定城市</span>
                <el-select v-model="bindCityId" filterable clearable placeholder="绑定城市" style="width: 138px">
                  <el-option
                    v-for="city in cityOptions"
                    :key="city.id"
                    :label="city.name"
                    :value="city.id"
                  />
                </el-select>
                <button class="select-btn active" :disabled="!bindCityId || bindingCity" @click="submitCityBinding">
                  保存
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="filteredFolders.length || filteredFiles.length"
            :class="['asset-area', viewMode, { selecting: boxSelecting }]"
            @mousedown="startBoxSelect"
          >
            <article
              v-for="folder in filteredFolders"
              :key="folder.id"
              class="folder-card"
              :data-folder-id="folder.id"
              :class="{ selected: selectedFolderIds.includes(folder.id) }"
              role="button"
              tabindex="0"
              @click="handleFolderCardClick(folder)"
              @keyup.enter="handleFolderCardClick(folder)"
              @dragover.prevent.stop
              @drop.prevent.stop="handleFolderDrop($event, folder)"
            >
              <label v-if="selectionMode || selectedFolderIds.includes(folder.id)" class="select-mark" title="选择文件夹" @click.stop>
                <input type="checkbox" :checked="selectedFolderIds.includes(folder.id)" @change="toggleFolderSelection(folder)" />
                <span><el-icon><Check /></el-icon></span>
              </label>
              <span class="folder-icon"><el-icon><Folder /></el-icon></span>
              <strong>{{ folder.name }}</strong>
              <em>{{ folder.folder_count || 0 }} 个下级 · {{ folder.file_count || 0 }} 个文件</em>
              <span class="folder-meta-strip">
                <small>直属 {{ folder.direct_file_count || 0 }}</small>
                <small>路径 {{ folder.path }}</small>
              </span>
              <div class="folder-actions" @click.stop>
                <button title="新增子级" @click="openFolderDialog(null, folder)"><el-icon><Plus /></el-icon></button>
                <button v-if="canCreateSiblingFor(folder)" title="新增同级" @click="openSiblingFolderDialog(folder)"><el-icon><Collection /></el-icon></button>
                <button v-if="!isSystemFolder(folder)" title="重命名" @click="openFolderDialog(folder)"><el-icon><EditPen /></el-icon></button>
                <button v-if="!isSystemFolder(folder)" class="danger" title="删除" @click="removeFolder(folder)"><el-icon><Delete /></el-icon></button>
              </div>
            </article>

            <article
              v-for="file in filteredFiles"
              :key="file.id"
              class="file-card"
              :data-file-id="file.id"
              :class="{ selected: selectedFile?.id === file.id, checked: selectedFileIds.includes(file.id) }"
              @click="handleFileCardClick(file)"
            >
              <label v-if="selectionMode || selectedFileIds.includes(file.id)" class="select-mark" title="选择素材" @click.stop>
                <input type="checkbox" :checked="selectedFileIds.includes(file.id)" @change="toggleFileSelection(file)" />
                <span><el-icon><Check /></el-icon></span>
              </label>
              <div class="thumb" @dblclick="openPreview(file)">
                <video
                  v-if="isVideo(file) && getMediaPreviewUrl(file)"
                  :src="getMediaPreviewUrl(file)"
                  muted
                  playsinline
                  preload="metadata"
                  :poster="file.thumbnail_url || ''"
                  @error="markPreviewError(file)"
                ></video>
                <img
                  v-else-if="isImage(file) && getMediaPreviewUrl(file)"
                  :src="getMediaPreviewUrl(file)"
                  :alt="file.name"
                  loading="lazy"
                  @error="markPreviewError(file)"
                />
                <div v-else class="thumb-fallback">
                  <el-icon><component :is="getFileIcon(file)" /></el-icon>
                  <span>{{ getFileKindLabel(file) }}</span>
                </div>
                <button class="play-btn" :title="canInlinePreview(file) ? '预览' : '打开文件'" @click.stop="openPreview(file)">
                  <el-icon><component :is="canInlinePreview(file) ? VideoPlay : Link" /></el-icon>
                </button>
              </div>
              <div class="file-main">
                <strong :title="file.name">{{ file.name }}</strong>
                <span>{{ file.size_human }} · {{ formatTime(file.uploaded_at) }}</span>
                <span>上传人：{{ file.uploaded_by || '未知' }}</span>
                <em v-if="file.type_name">{{ file.type_name }}</em>
                <em class="usage-chip" :class="{ unused: !file.distribution_count, failed: file.failed_count }">
                  {{ materialUsageLabel(file) }}
                </em>
              </div>
              <div class="file-actions">
                <button title="预览" @click.stop="openPreview(file)"><el-icon><View /></el-icon></button>
                <button title="分享" @click.stop="shareFile(file)"><el-icon><Share /></el-icon></button>
                <button title="下载" @click.stop="downloadFile(file)"><el-icon><Download /></el-icon></button>
                <button title="复制链接" @click.stop="copyLink(file)"><el-icon><Link /></el-icon></button>
                <button title="复制路径" @click.stop="copyPath(file)"><el-icon><FolderOpened /></el-icon></button>
                <button title="移动到" @click.stop="openMoveDialog([file])"><el-icon><Folder /></el-icon></button>
                <button title="重命名" @click.stop="openRename(file)"><el-icon><EditPen /></el-icon></button>
                <button title="删除" class="danger" @click.stop="removeFile(file)"><el-icon><Delete /></el-icon></button>
              </div>
            </article>
          </div>
          <div
            v-if="boxSelecting"
            class="selection-rect"
            :style="{ left: selectionRect.left + 'px', top: selectionRect.top + 'px', width: selectionRect.width + 'px', height: selectionRect.height + 'px' }"
          ></div>

          <div v-if="!(filteredFolders.length || filteredFiles.length)" class="empty-state">
            <div class="empty-icon"><el-icon><FolderOpened /></el-icon></div>
            <strong>{{ keyword ? '没有匹配的素材' : '当前文件夹为空' }}</strong>
            <p>{{ canUploadToCurrent ? '拖拽视频、图片、压缩包或文档到这里，或点击右上角上传。' : '系统目录只用于归档展示，请选择普通文件夹上传。' }}</p>
            <button v-if="canUploadToCurrent" class="primary-btn solid" @click="pickFile">
              <el-icon><Upload /></el-icon>
              上传素材
            </button>
          </div>
        </div>
      </section>

    </main>

    <div class="dialog-overlay detail-drawer-overlay" v-if="detailDrawerVisible" @click.self="detailDrawerVisible = false">
      <aside class="detail-pane detail-drawer" @click.stop>
        <div class="drawer-head">
          <div>
            <strong>目录与文件详情</strong>
            <span>{{ selectedFile ? selectedFile.name : currentFolder?.path || '/' }}</span>
          </div>
          <button class="icon-close" @click="detailDrawerVisible = false"><el-icon><Close /></el-icon></button>
        </div>
        <section class="upload-panel">
          <div class="detail-head">
            <div>
              <strong>上传到当前文件夹</strong>
            <span>{{ canUploadToCurrent ? currentFolder?.path : '请选择普通文件夹' }}</span>
            </div>
          </div>
          <div class="type-select">
            <label>素材类型</label>
            <el-select v-model="selectedTypeId" placeholder="选择类型" style="width: 100%">
              <el-option v-for="t in videoTypes" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </div>
          <button class="upload-box" :disabled="!canUploadToCurrent" @click="pickFile">
            <el-icon><UploadFilled /></el-icon>
            <strong>选择素材文件</strong>
            <span>{{ uploadPathPreview }}</span>
          </button>
        </section>

        <section class="info-panel">
          <div class="detail-head">
            <div>
              <strong>{{ selectedFile ? '文件详情' : '文件夹详情' }}</strong>
              <span>{{ selectedFile ? '当前选中文件' : '当前选中目录' }}</span>
            </div>
          </div>

          <div v-if="selectedFile" class="file-detail">
            <div class="detail-preview" @click="openPreview(selectedFile)">
              <video v-if="isVideo(selectedFile) && getMediaPreviewUrl(selectedFile)" :src="getMediaPreviewUrl(selectedFile)" muted playsinline preload="metadata"></video>
              <img v-else-if="isImage(selectedFile) && getMediaPreviewUrl(selectedFile)" :src="getMediaPreviewUrl(selectedFile)" :alt="selectedFile.name" />
              <el-icon v-else><component :is="getFileIcon(selectedFile)" /></el-icon>
            </div>
            <h3>{{ selectedFile.name }}</h3>
            <dl>
              <div><dt>大小</dt><dd>{{ selectedFile.size_human }}</dd></div>
              <div><dt>类型</dt><dd>{{ selectedFile.type_name || '未分类' }}</dd></div>
              <div><dt>上传人</dt><dd>{{ selectedFile.uploaded_by || '未知' }}</dd></div>
              <div><dt>上传时间</dt><dd>{{ formatTime(selectedFile.uploaded_at) }}</dd></div>
              <div><dt>目录</dt><dd>{{ selectedFile.folder_path || currentFolder?.path || '历史素材' }}</dd></div>
              <div><dt>下发次数</dt><dd>{{ selectedFile.distribution_count || 0 }}</dd></div>
              <div><dt>已发布</dt><dd>{{ selectedFile.published_count || 0 }}</dd></div>
              <div><dt>异常</dt><dd>{{ selectedFile.failed_count || 0 }}</dd></div>
              <div><dt>最近下发</dt><dd>{{ selectedFile.last_distributed_at ? formatTime(selectedFile.last_distributed_at) : '-' }}</dd></div>
              <div><dt>对象 Key</dt><dd>{{ selectedFile.key || '-' }}</dd></div>
            </dl>
            <div class="detail-actions">
              <button @click="openPreview(selectedFile)"><el-icon><View /></el-icon>预览</button>
              <button @click="shareFile(selectedFile)"><el-icon><Share /></el-icon>分享</button>
              <button @click="downloadFile(selectedFile)"><el-icon><Download /></el-icon>下载</button>
              <button @click="copyLink(selectedFile)"><el-icon><Link /></el-icon>链接</button>
              <button @click="openMoveDialog([selectedFile])"><el-icon><Folder /></el-icon>移动</button>
            </div>
          </div>

          <div v-else class="folder-detail">
            <span class="big-folder"><el-icon><FolderOpened /></el-icon></span>
            <h3>{{ currentFolder?.name || '我的素材' }}</h3>
            <dl>
              <div><dt>路径</dt><dd>{{ currentFolder?.path || '/' }}</dd></div>
              <div><dt>子文件夹</dt><dd>{{ childFolders.length }}</dd></div>
              <div><dt>直属文件</dt><dd>{{ currentDirectFileCount }}</dd></div>
              <div><dt>下级汇总文件</dt><dd>{{ currentTotalFileCount }}</dd></div>
              <div><dt>容量</dt><dd>{{ totalSizeHuman }}</dd></div>
            </dl>
            <div class="folder-admin-actions">
              <button :disabled="!canCreateInCurrent" @click="openFolderDialog(null, currentFolder)">
                <el-icon><Plus /></el-icon>
                新建子文件夹
              </button>
              <button :disabled="!canCreateRootOrSiblingFolder" @click="openSiblingFolderDialog()">
                <el-icon><Collection /></el-icon>
                新建同级
              </button>
              <button :disabled="!canCreateInCurrent" @click="createNextDateFolder">
                <el-icon><Calendar /></el-icon>
                新增日期
              </button>
              <button v-if="!isSystemFolder(currentFolder)" @click="openFolderDialog(currentFolder)">
                <el-icon><EditPen /></el-icon>
                重命名
              </button>
              <button v-if="!isSystemFolder(currentFolder)" class="danger" @click="removeFolder(currentFolder)">
                <el-icon><Delete /></el-icon>
                删除
              </button>
            </div>
            <div class="bind-city-box" v-if="canBindCurrentFolder">
              <label>绑定城市</label>
              <div class="bind-row">
                <el-select v-model="bindCityId" filterable clearable placeholder="选择城市" style="width: 100%">
                  <el-option
                    v-for="city in cityOptions"
                    :key="city.id"
                    :label="city.name"
                    :value="city.id"
                  />
                </el-select>
                <button class="primary-btn solid" :disabled="!bindCityId || bindingCity" @click="submitCityBinding">
                  保存
                </button>
              </div>
              <p v-if="boundCityNames.length">已绑定：{{ boundCityNames.join('、') }}</p>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <div class="floating-actions material-floating-actions">
      <div class="floating-action-row">
        <button class="float-secondary" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          刷新
        </button>
        <button class="float-secondary" :disabled="!canCreateInCurrent" @click="openFolderDialog()">
          <el-icon><FolderAdd /></el-icon>
          子级
        </button>
        <button class="float-secondary" :disabled="!canCreateRootOrSiblingFolder" @click="openSiblingFolderDialog()" :title="isRootFolder(currentFolder) ? '在文件树顶级新建文件夹' : '在当前目录旁边新建同级文件夹'">
          <el-icon><Collection /></el-icon>
          {{ isRootFolder(currentFolder) ? '顶级' : '同级' }}
        </button>
        <button class="float-secondary" :disabled="!canCreateInCurrent" @click="createNextDateFolder">
          <el-icon><Calendar /></el-icon>
          日期
        </button>
        <button class="float-main" :disabled="!canUploadToCurrent" @click="pickFile">
          <el-icon><Upload /></el-icon>
          上传素材
        </button>
      </div>
    </div>

    <div class="dialog-overlay" v-if="folderDialogVisible" @click.self="closeFolderDialog">
      <div class="dialog-card small" @click.stop>
        <div class="dialog-head">
          <h3>{{ folderForm.id ? '重命名文件夹' : '新建文件夹' }}</h3>
          <button class="icon-close" @click="closeFolderDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <p v-if="!folderForm.id" class="dialog-hint">创建位置：{{ folderCreatePositionLabel }}</p>
          <label class="field-label">文件夹名称</label>
          <input v-model="folderForm.name" class="inline-input" placeholder="例如：郑州 / 7.25 / 活动素材" @keyup.enter="submitFolder" />
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeFolderDialog">取消</button>
          <button class="primary-btn solid" :disabled="!folderForm.name" @click="submitFolder">保存</button>
        </div>
      </div>
    </div>

    <div class="dialog-overlay" v-if="renameVisible" @click.self="closeRename">
      <div class="dialog-card small" @click.stop>
        <div class="dialog-head">
          <h3>重命名文件</h3>
          <button class="icon-close" @click="closeRename"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <label class="field-label">新的文件名称</label>
          <input v-model="renameForm.name" class="inline-input" @keyup.enter="confirmRename" />
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeRename">取消</button>
          <button class="primary-btn solid" :disabled="!renameForm.name" @click="confirmRename">保存</button>
        </div>
      </div>
    </div>

    <div class="dialog-overlay" v-if="moveVisible" @click.self="closeMoveDialog">
      <div class="dialog-card move-card" @click.stop>
        <div class="dialog-head">
          <div>
            <h3>移动素材</h3>
            <p>把已选素材移动到指定文件夹，不会重新上传文件。</p>
          </div>
          <button class="icon-close" @click="closeMoveDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="move-summary">
            <span>待移动</span>
            <strong>{{ moveTargetFiles.length }} 个素材</strong>
            <em>{{ selectedMoveFolder?.path || '请选择目标文件夹' }}</em>
          </div>
          <div class="move-file-list">
            <span v-for="file in moveTargetFiles" :key="file.id" :title="file.name">{{ file.name }}</span>
          </div>
          <label class="field-label">目标文件夹</label>
          <el-select v-model="moveTargetFolderId" filterable placeholder="选择要移动到的文件夹" style="width: 100%">
            <el-option
              v-for="folder in moveFolderOptions"
              :key="folder.id"
              :label="folder.path"
              :value="folder.id"
            />
          </el-select>
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeMoveDialog">取消</button>
          <button class="primary-btn solid" :disabled="!canConfirmMove || movingFiles" @click="confirmMoveFiles">
            {{ movingFiles ? '移动中' : '确认移动' }}
          </button>
        </div>
      </div>
    </div>

    <div class="dialog-overlay" v-if="previewVisible" @click.self="closePreview">
      <div class="dialog-card preview-card" @click.stop>
        <div class="dialog-head">
          <div>
            <h3>{{ previewFile?.name || '素材预览' }}</h3>
            <p>{{ previewFile?.size_human }} · {{ formatTime(previewFile?.uploaded_at) }}</p>
          </div>
          <button class="icon-close" @click="closePreview"><el-icon><Close /></el-icon></button>
        </div>
        <div class="preview-body">
          <video
            v-if="isVideo(previewFile) && !previewError"
            :src="getMediaPreviewUrl(previewFile)"
            controls
            autoplay
            muted
            playsinline
            class="preview-video"
            @error="onPreviewError"
          ></video>
          <img
            v-else-if="isImage(previewFile) && !previewError"
            :src="getMediaPreviewUrl(previewFile)"
            :alt="previewFile?.name || '图片预览'"
            class="preview-image"
            @error="onPreviewError"
          />
          <a v-else class="preview-other" :href="previewFile?.url" target="_blank" rel="noopener">
            <el-icon><component :is="getFileIcon(previewFile)" /></el-icon>
            在新窗口打开
          </a>
        </div>
      </div>
    </div>

    <section v-if="uploadingQueue.length" class="floating-upload-panel" :class="{ collapsed: uploadPanelCollapsed }">
      <header class="floating-upload-head">
        <div>
          <strong>上传任务</strong>
          <span>{{ uploadQueueSummary }}</span>
        </div>
        <button type="button" @click="uploadPanelCollapsed = !uploadPanelCollapsed">
          {{ uploadPanelCollapsed ? '展开' : '收起' }}
        </button>
      </header>
      <div v-if="!uploadPanelCollapsed" class="floating-upload-body">
        <div v-for="u in uploadingQueue" :key="u.tempId" class="queue-row" :class="u.status">
          <div>
            <strong>{{ u.name }}</strong>
            <span>{{ u.msg }}</span>
            <small>保存到 {{ u.folderPath }}</small>
            <small v-if="u.speedText || u.remainingText">{{ u.speedText || '等待测速' }}<template v-if="u.remainingText"> · 剩余 {{ u.remainingText }}</template></small>
          </div>
          <div class="progress-line"><i :style="{ width: u.percent + '%' }"></i></div>
          <em>{{ u.percent }}%</em>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onErrorCaptured, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  Box, Calendar, Check, Close, Collection, Delete, Document, Download, EditPen, Files, Folder, FolderAdd, FolderOpened,
  Grid, Link, Picture, Plus, Refresh, Search, Share, Tickets, Upload, UploadFilled, VideoCamera, VideoPlay, View
} from '@element-plus/icons-vue'
import {
  createMaterialFile, createMaterialFolder, createMediaPreviewToken, createMediaShareToken, deleteMaterialFile,
  deleteMaterialFolder, getCities, getMaterialFiles, getMaterialFolderTree, getMaterialUploadStats, getVideoTypes, bindCityMaterialFolder,
  updateMaterialFile, updateMaterialFolder
} from '@/api'
import cos from '@/utils/cos'
import upyun from '@/utils/upyun'
import { loadSystemSettings } from '@/utils/systemSettings'

const ROOT_FOLDER_ID = 'folder_root'
const LEGACY_FOLDER_ID = 'folder_legacy'
const TREE_ROOT_ID = 'folder_workspace_root'
const materialAccept = [
  'video/*',
  'image/*',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv'
].join(',')

const defaultFolderTree = () => ({
  id: TREE_ROOT_ID,
  name: '文件树根目录',
  parent_id: null,
  path: '/',
  storage_policy_id: 'default',
  folder_count: 0,
  file_count: 0,
  direct_file_count: 0,
  children: [{
    id: ROOT_FOLDER_ID,
    name: '我的素材',
    parent_id: null,
    path: '/',
    storage_policy_id: 'default',
    folder_count: 0,
    file_count: 0,
    direct_file_count: 0,
    children: []
  }]
})

const treeRef = ref(null)
const fileInputRef = ref(null)
const dropSurfaceRef = ref(null)
const folderTree = ref(defaultFolderTree())
const currentFolderId = ref(ROOT_FOLDER_ID)
const treeLoading = ref(false)
const filesLoading = ref(false)
const isDragging = ref(false)
const keyword = ref('')
const folderSearch = ref('')
const sortMode = ref('time')
const viewMode = ref('grid')
const fileList = ref([])
const videoTypes = ref([])
const cityOptions = ref([])
const selectedTypeId = ref('')
const selectedFile = ref(null)
const selectionMode = ref(false)
const selectedFolderIds = ref([])
const selectedFileIds = ref([])
const boxSelecting = ref(false)
const suppressNextCardClick = ref(false)
const selectionStart = reactive({ x: 0, y: 0 })
const selectionRect = reactive({ left: 0, top: 0, width: 0, height: 0 })
let pendingBoxSelect = null
const bindCityId = ref('')
const bindingCity = ref(false)
const mediaPreviewUrls = ref({})
const previewErrorKeys = ref({})
const uploadingQueue = reactive([])
const uploadPanelCollapsed = ref(false)
const uploadStatsMonth = ref(dayjs().format('YYYY-MM'))
const uploadStatsRows = ref([])
const uploadStatsSummary = ref(null)
const uploaderFilter = ref('')

const folderDialogVisible = ref(false)
const folderForm = reactive({ id: '', name: '', parentId: '' })
const folderContextMenu = reactive({ visible: false, x: 0, y: 0, folder: null })
const renameVisible = ref(false)
const renameTarget = ref(null)
const renameForm = reactive({ name: '' })
const moveVisible = ref(false)
const moveTargetFiles = ref([])
const moveTargetFolderId = ref('')
const movingFiles = ref(false)
const previewVisible = ref(false)
const previewFile = ref(null)
const previewError = ref(false)
const detailDrawerVisible = ref(false)

const normalizeFolder = (folder = {}) => {
  const children = Array.isArray(folder.children) ? folder.children.map(normalizeFolder) : []
  const hasServerDirectCount = Object.prototype.hasOwnProperty.call(folder, 'direct_file_count')
  const directFileCount = Number(hasServerDirectCount ? folder.direct_file_count : folder.file_count || 0)
  const childFileCount = children.reduce((sum, child) => sum + Number(child.file_count || 0), 0)
  const childFolderCount = children.reduce((sum, child) => sum + 1 + Number(child.folder_count || 0), 0)
  return {
    ...folder,
    id: String(folder.id || ''),
    name: String(folder.name || '未命名文件夹'),
    parent_id: folder.parent_id || null,
    path: String(folder.path || '/'),
    storage_policy_id: folder.storage_policy_id || 'default',
    folder_count: childFolderCount,
    file_count: directFileCount + childFileCount,
    direct_file_count: directFileCount,
    children
  }
}

const flattenFolders = (node, list = []) => {
  if (!node) return list
  list.push(node)
  ;(Array.isArray(node.children) ? node.children : []).forEach(child => flattenFolders(child, list))
  return list
}

const folderTreeRoots = computed(() => Array.isArray(folderTree.value?.children) ? folderTree.value.children : [])
const folderList = computed(() => folderTreeRoots.value.reduce((list, folder) => flattenFolders(folder, list), []))
const currentFolder = computed(() => folderList.value.find(item => item.id === currentFolderId.value) || folderTree.value)
const moveFolderOptions = computed(() => folderList.value.filter(folder => folder?.id && !isSystemFolder(folder)))
const childFolders = computed(() => currentFolder.value?.children || [])
const folderAncestorIds = (folder) => {
  const folders = folderList.value
  const ids = []
  let node = folder
  while (node?.parent_id) {
    ids.unshift(node.parent_id)
    node = folders.find(item => item.id === node.parent_id)
  }
  return ids
}
const expandedFolderKeys = computed(() => {
  const keys = folderAncestorIds(currentFolder.value)
  if (currentFolderId.value && currentFolderId.value !== ROOT_FOLDER_ID) {
    keys.push(currentFolderId.value)
  }
  return Array.from(new Set(keys.filter(Boolean)))
})
const canUploadToCurrent = computed(() => currentFolderId.value && currentFolderId.value !== LEGACY_FOLDER_ID)
const canCreateInCurrent = computed(() => currentFolderId.value && currentFolderId.value !== LEGACY_FOLDER_ID)
const currentParentFolder = computed(() => currentFolder.value?.parent_id ? folderList.value.find(item => item.id === currentFolder.value?.parent_id) || null : { id: TREE_ROOT_ID, path: '/' })
const canCreateSiblingFolder = computed(() => Boolean(currentParentFolder.value && currentParentFolder.value.id !== LEGACY_FOLDER_ID))
const canCreateRootOrSiblingFolder = computed(() => canCreateInCurrent.value || canCreateSiblingFolder.value)
const canBindCurrentFolder = computed(() => currentFolderId.value && ![ROOT_FOLDER_ID, LEGACY_FOLDER_ID].includes(currentFolderId.value))
const currentTypeName = computed(() => videoTypes.value.find(t => t.id === selectedTypeId.value)?.name || '未分类')
const totalSizeHuman = computed(() => formatBytes(fileList.value.reduce((sum, file) => sum + Number(file.size || 0), 0)))
const currentDirectFileCount = computed(() => Number(currentFolder.value?.direct_file_count ?? fileList.value.length ?? 0))
const currentTotalFileCount = computed(() => Number(currentFolder.value?.file_count ?? fileList.value.length ?? 0))
const uploadPathPreview = computed(() => {
  const path = currentFolder.value?.path || '/'
  const clean = path === '/' ? '' : path
  return `${clean}/<素材文件>`
})

const breadcrumbs = computed(() => {
  const folders = folderList.value
  const crumbs = []
  let node = currentFolder.value
  while (node) {
    crumbs.unshift(node)
    if (!node.parent_id) break
    node = folders.find(item => item.id === node.parent_id)
  }
  return crumbs
})

const filteredFolders = computed(() => {
  const word = String(keyword.value || '').trim().toLowerCase()
  if (!word) return childFolders.value
  return childFolders.value.filter(folder => String(folder.name || '').toLowerCase().includes(word) || String(folder.path || '').toLowerCase().includes(word))
})

const folderSearchResults = computed(() => {
  const word = String(folderSearch.value || '').trim().toLowerCase()
  if (!word) return []
  return folderList.value
    .filter(folder => folder.id !== ROOT_FOLDER_ID)
    .filter(folder => [folder.name, folder.path].some(value => String(value || '').toLowerCase().includes(word)))
    .slice(0, 24)
})

const filteredFiles = computed(() => {
  const word = String(keyword.value || '').trim().toLowerCase()
  const list = word
    ? fileList.value.filter(file => [file.name, file.type_name, file.key, file.folder_path].some(value => String(value || '').toLowerCase().includes(word)))
    : [...fileList.value]

  list.sort((a, b) => {
    if (sortMode.value === 'name') return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN')
    if (sortMode.value === 'size') return Number(b.size || 0) - Number(a.size || 0)
    return new Date(b.uploaded_at || b.created_at || 0) - new Date(a.uploaded_at || a.created_at || 0)
  })
  return list
})

const selectedFiles = computed(() => fileList.value.filter(file => selectedFileIds.value.includes(file.id)))
const selectedFolders = computed(() => childFolders.value.filter(folder => selectedFolderIds.value.includes(folder.id)))
const selectedItemCount = computed(() => selectedFolderIds.value.length + selectedFileIds.value.length)
const selectedMoveFolder = computed(() => moveFolderOptions.value.find(folder => folder.id === moveTargetFolderId.value) || null)
const canConfirmMove = computed(() => {
  if (!moveTargetFolderId.value || !moveTargetFiles.value.length || movingFiles.value) return false
  return moveTargetFiles.value.some(file => String(file.folder_id || '') !== String(moveTargetFolderId.value))
})
const visibleItemCount = computed(() => filteredFolders.value.length + filteredFiles.value.length)
const isAllVisibleSelected = computed(() => {
  if (!visibleItemCount.value) return false
  return filteredFolders.value.every(folder => selectedFolderIds.value.includes(folder.id)) &&
    filteredFiles.value.every(file => selectedFileIds.value.includes(file.id))
})
const boundCityNames = computed(() => cityOptions.value
  .filter(city => city.material_folder_id === currentFolderId.value)
  .map(city => city.name))
const uploadQueueSummary = computed(() => {
  const total = uploadingQueue.length
  if (!total) return '暂无上传'
  const done = uploadingQueue.filter(item => item.status === 'done').length
  const failed = uploadingQueue.filter(item => item.status === 'failed').length
  const percent = Math.round(uploadingQueue.reduce((sum, item) => sum + Number(item.percent || 0), 0) / total)
  const parts = [`${total} 个文件`, `整体 ${percent}%`]
  if (done) parts.push(`完成 ${done}`)
  if (failed) parts.push(`失败 ${failed}`)
  return parts.join(' · ')
})
const uploadStatsTotal = computed(() => uploadStatsSummary.value?.totals || {
  total_count: 0,
  video_count: 0,
  image_count: 0,
  total_size: 0
})
const uploadStatsDateRange = computed(() => {
  const range = uploadStatsSummary.value?.dateRange
  return range?.start && range?.end ? `${range.start} 至 ${range.end}` : uploadStatsMonth.value
})
const uploaderOptions = computed(() => uploadStatsRows.value)
const folderCreatePositionLabel = computed(() => {
  if (folderForm.parentId === TREE_ROOT_ID) return '文件树顶级'
  return folderList.value.find(item => item.id === folderForm.parentId)?.path || currentFolder.value?.path || '/'
})

const formatUploadSpeed = (bytesPerSecond = 0) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

const formatRemainingTime = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.ceil(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hours}小时${mins}分` : `${hours}小时`
  }
  if (minutes) return `${minutes}分${rest}秒`
  return `${rest}秒`
}

const runUploadQueue = async (items, limit, worker) => {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(Math.max(1, limit), queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
    }
  })
  await Promise.all(workers)
}

const isTreeRoot = (folder) => folder?.id === TREE_ROOT_ID
const isSystemFolder = (folder) => [TREE_ROOT_ID, ROOT_FOLDER_ID, LEGACY_FOLDER_ID].includes(folder?.id)
const isRootFolder = (folder) => folder?.id === ROOT_FOLDER_ID
const canUploadToFolder = (folder) => folder?.id && ![TREE_ROOT_ID, LEGACY_FOLDER_ID].includes(folder.id)
const canCreateFolderIn = (folder) => folder?.id && folder.id !== LEGACY_FOLDER_ID
const canCreateSiblingFor = (folder) => {
  if (!folder?.id || folder.id === LEGACY_FOLDER_ID) return false
  if (isRootFolder(folder) || isTreeRoot(folder) || !folder.parent_id) return true
  return folder.parent_id !== LEGACY_FOLDER_ID
}
const getActiveStorageProvider = () => loadSystemSettings()?.storage?.provider === 'upyun' ? 'upyun' : 'cos'
const deleteCloudObject = (file) => {
  if (!file?.key) return Promise.resolve()
  return file.storage_provider === 'upyun' ? upyun.deleteObject(file.key) : cos.deleteObject(file.key)
}

const normalizeFile = (file = {}) => ({
  id: String(file.id || file.key || file.cos_key || ''),
  name: String(file.name || '未命名素材'),
  size: Number(file.size || 0),
  size_human: formatBytes(file.size),
  type_name: String(file.type_name || ''),
  video_type_id: file.video_type_id || '',
  url: file.url || '',
  key: file.cos_key || file.key || file.object_key || '',
  storage_provider: file.storage_provider || file.provider || 'cos',
  folder_id: file.folder_id || '',
  folder_path: file.folder_path || '',
  uploaded_by_user_id: file.uploaded_by_user_id || '',
  uploaded_by: file.uploaded_by || file.uploader_name || file.uploader_username || '',
  distribution_count: Number(file.distribution_count || 0),
  published_count: Number(file.published_count || 0),
  failed_count: Number(file.failed_count || 0),
  last_distributed_at: file.last_distributed_at || '',
  uploaded_at: file.uploaded_at || file.created_at || '',
  duration: file.duration || null,
  mime: file.mime || '',
  thumbnail_url: file.thumbnail_url || ''
})

const materialUsageLabel = (file) => {
  if (!file?.distribution_count) return '未下发'
  const pieces = [`下发 ${file.distribution_count} 次`]
  if (file.published_count) pieces.push(`发布 ${file.published_count}`)
  if (file.failed_count) pieces.push(`异常 ${file.failed_count}`)
  return pieces.join(' · ')
}

const syncTreeExpansion = () => {
  const allowedKeys = new Set(expandedFolderKeys.value)
  const nodesMap = treeRef.value?.store?.nodesMap || {}
  Object.entries(nodesMap).forEach(([key, node]) => {
    if (!allowedKeys.has(key)) node.expanded = false
  })
}

const loadFolderTree = async () => {
  treeLoading.value = true
  try {
    const remoteTree = await getMaterialFolderTree()
    const normalized = normalizeFolder(remoteTree)
    folderTree.value = normalized.id === TREE_ROOT_ID
      ? normalized
      : normalizeFolder({ ...defaultFolderTree(), children: [normalized] })
    if (!folderList.value.some(folder => folder.id === currentFolderId.value)) {
      currentFolderId.value = ROOT_FOLDER_ID
    }
    await nextTick()
    treeRef.value?.setCurrentKey(currentFolderId.value)
    syncTreeExpansion()
  } catch (e) {
    folderTree.value = defaultFolderTree()
    ElMessage.error('目录加载失败：' + (e.message || '未知错误'))
  } finally {
    treeLoading.value = false
  }
}

const loadFiles = async () => {
  filesLoading.value = true
  selectedFile.value = null
  selectedFileIds.value = []
  try {
    const params = { folderId: currentFolderId.value, pageSize: 300 }
    if (uploaderFilter.value) {
      if (String(uploaderFilter.value).startsWith('legacy:')) {
        const legacyName = String(uploaderFilter.value).slice('legacy:'.length)
        if (legacyName && legacyName !== 'unknown') params.uploadedBy = legacyName
      } else {
        params.uploaderId = uploaderFilter.value
      }
    }
    const res = await getMaterialFiles(params)
    fileList.value = (res.list || []).map(normalizeFile)
    fileList.value.slice(0, 12).forEach(file => {
      if (canInlinePreview(file)) ensureMediaPreviewUrl(file).catch(() => {})
    })
  } catch (e) {
    ElMessage.error('文件加载失败：' + (e.message || '未知错误'))
  } finally {
    filesLoading.value = false
  }
}

const loadUploadStats = async () => {
  try {
    const data = await getMaterialUploadStats({ month: uploadStatsMonth.value || dayjs().format('YYYY-MM') })
    uploadStatsSummary.value = data || null
    uploadStatsRows.value = Array.isArray(data?.list) ? data.list : []
    if (uploaderFilter.value && !uploadStatsRows.value.some(item => item.uploader_id === uploaderFilter.value)) {
      uploaderFilter.value = ''
      await loadFiles()
    }
  } catch (e) {
    uploadStatsRows.value = []
    uploadStatsSummary.value = null
    ElMessage.error('上传统计加载失败：' + getErrorMessage(e))
  }
}

const toggleUploaderFilter = async (person) => {
  uploaderFilter.value = uploaderFilter.value === person.uploader_id ? '' : person.uploader_id
  await loadFiles()
}

const loadTypes = async () => {
  try {
    const types = await getVideoTypes()
    videoTypes.value = Array.isArray(types) ? types.map(type => ({
      ...type,
      id: String(type.id || ''),
      name: String(type.name || '未分类')
    })) : []
    selectedTypeId.value = videoTypes.value[0]?.id || ''
  } catch {
    videoTypes.value = []
  }
}

const loadCities = async () => {
  try {
    cityOptions.value = await getCities()
  } catch {
    cityOptions.value = []
  }
}

const loadAll = async () => {
  await Promise.all([loadFolderTree(), loadTypes(), loadCities(), loadUploadStats()])
  await loadFiles()
}

const selectFolder = async (folder) => {
  if (!folder?.id || currentFolderId.value === folder.id) return
  currentFolderId.value = folder.id
  keyword.value = ''
  clearSelection()
  await nextTick()
  treeRef.value?.setCurrentKey(folder.id)
  await loadFiles()
}

const closeFolderContextMenu = () => {
  folderContextMenu.visible = false
  folderContextMenu.folder = null
}

const showFolderContextMenu = async (event, folder, shouldSelect = false) => {
  if (!folder?.id) return
  folderContextMenu.visible = false
  folderContextMenu.folder = folder
  folderContextMenu.x = Math.min(event.clientX, window.innerWidth - 180)
  folderContextMenu.y = Math.min(event.clientY, window.innerHeight - 190)
  if (shouldSelect && currentFolderId.value !== folder.id) {
    await selectFolder(folder)
  }
  await nextTick()
  folderContextMenu.visible = true
}

const openFolderContextMenu = async (event, folder = currentFolder.value) => {
  await showFolderContextMenu(event, folder, true)
}

const openBlankFolderContextMenu = async (event) => {
  if (event.target?.closest?.('.tree-node, .tree-actions, button, input')) return
  await showFolderContextMenu(event, folderTree.value, false)
}

const runFolderContextAction = async (action) => {
  const folder = folderContextMenu.folder
  closeFolderContextMenu()
  if (!folder?.id) return
  if (action === 'child') return openFolderDialog(null, folder)
  if (action === 'sibling') return openSiblingFolderDialog(folder)
  if (action === 'rename') return openFolderDialog(folder)
  if (action === 'delete') return removeFolder(folder)
}

const toggleInList = (list, id) => {
  if (!id) return list
  return list.includes(id) ? list.filter(item => item !== id) : [...list, id]
}

const toggleSelectionMode = () => {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) clearSelection()
}

const selectFile = (file) => {
  selectedFile.value = file
}

const handleFolderCardClick = (folder) => {
  if (suppressNextCardClick.value) {
    suppressNextCardClick.value = false
    return
  }
  if (selectionMode.value) {
    toggleFolderSelection(folder)
    return
  }
  selectFolder(folder)
}

const handleFileCardClick = (file) => {
  if (suppressNextCardClick.value) {
    suppressNextCardClick.value = false
    return
  }
  if (selectionMode.value) {
    toggleFileSelection(file)
    return
  }
  selectFile(file)
}

const toggleFileSelection = (file) => {
  selectedFileIds.value = toggleInList(selectedFileIds.value, file?.id)
  selectedFile.value = file
}

const toggleFolderSelection = (folder) => {
  selectedFolderIds.value = toggleInList(selectedFolderIds.value, folder?.id)
}

const toggleSelectAllVisible = () => {
  if (isAllVisibleSelected.value) {
    const visibleFolderIds = new Set(filteredFolders.value.map(folder => folder.id))
    const visibleFileIds = new Set(filteredFiles.value.map(file => file.id))
    selectedFolderIds.value = selectedFolderIds.value.filter(id => !visibleFolderIds.has(id))
    selectedFileIds.value = selectedFileIds.value.filter(id => !visibleFileIds.has(id))
    return
  }
  selectedFolderIds.value = Array.from(new Set([...selectedFolderIds.value, ...filteredFolders.value.map(folder => folder.id)]))
  selectedFileIds.value = Array.from(new Set([...selectedFileIds.value, ...filteredFiles.value.map(file => file.id)]))
}

const clearSelection = () => {
  selectedFolderIds.value = []
  selectedFileIds.value = []
}

const parseDateFolderName = (name = '') => {
  const text = String(name || '').trim()
  let match = text.match(/^(\d{1,2})[.月-](\d{1,2})日?$/)
  if (match) {
    const date = dayjs(`${dayjs().year()}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`)
    return date.isValid() ? date : null
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const date = dayjs(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`)
    return date.isValid() ? date : null
  }
  return null
}

const nextDateFolderName = () => {
  const dates = childFolders.value
    .map(folder => parseDateFolderName(folder.name))
    .filter(Boolean)
    .sort((a, b) => a.valueOf() - b.valueOf())
  let date = dates.length ? dates[dates.length - 1].add(1, 'day') : dayjs()
  const existing = new Set(childFolders.value.map(folder => String(folder.name || '').trim()))
  while (existing.has(`${date.month() + 1}.${date.date()}`)) date = date.add(1, 'day')
  return `${date.month() + 1}.${date.date()}`
}

const createNextDateFolder = async () => {
  if (!canCreateInCurrent.value) return ElMessage.warning('请选择普通文件夹后再新增日期')
  const name = nextDateFolderName()
  try {
    const folder = await createMaterialFolder({ name, parent_id: currentFolderId.value })
    ElMessage.success(`已创建日期文件夹 ${name}`)
    await loadFolderTree()
    if (folder?.id) await selectFolder(folder)
  } catch (e) {
    ElMessage.error('新增日期失败：' + (e.message || '未知错误'))
  }
}

const isInteractiveSelectTarget = (target) => Boolean(target?.closest?.('button, input, select, textarea, label, video, .file-actions, .folder-actions, .select-mark, .play-btn'))

const resetSelectionRect = () => {
  selectionRect.left = 0
  selectionRect.top = 0
  selectionRect.width = 0
  selectionRect.height = 0
}

const rectsIntersect = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)

const updateBoxSelection = () => {
  const rect = {
    left: selectionRect.left,
    top: selectionRect.top,
    right: selectionRect.left + selectionRect.width,
    bottom: selectionRect.top + selectionRect.height
  }
  const root = dropSurfaceRef.value
  if (!root) return
  const nextFolderIds = []
  const nextFileIds = []
  root.querySelectorAll('[data-folder-id]').forEach((node) => {
    if (rectsIntersect(rect, node.getBoundingClientRect())) nextFolderIds.push(node.dataset.folderId)
  })
  root.querySelectorAll('[data-file-id]').forEach((node) => {
    if (rectsIntersect(rect, node.getBoundingClientRect())) nextFileIds.push(node.dataset.fileId)
  })
  selectedFolderIds.value = Array.from(new Set(nextFolderIds.filter(Boolean)))
  selectedFileIds.value = Array.from(new Set(nextFileIds.filter(Boolean)))
}

const updateSelectionRectFromPointer = (event) => {
  selectionRect.left = Math.min(selectionStart.x, event.clientX)
  selectionRect.top = Math.min(selectionStart.y, event.clientY)
  selectionRect.width = Math.abs(event.clientX - selectionStart.x)
  selectionRect.height = Math.abs(event.clientY - selectionStart.y)
}

const handleBoxSelectMove = (event) => {
  if (!pendingBoxSelect) return
  const moved = Math.hypot(event.clientX - selectionStart.x, event.clientY - selectionStart.y)
  if (!boxSelecting.value && moved < 6) return
  if (!boxSelecting.value) {
    boxSelecting.value = true
    selectionMode.value = true
    selectedFile.value = null
    clearSelection()
  }
  event.preventDefault()
  updateSelectionRectFromPointer(event)
  updateBoxSelection()
}

const stopBoxSelect = () => {
  if (boxSelecting.value) {
    suppressNextCardClick.value = true
    setTimeout(() => { suppressNextCardClick.value = false }, 0)
  }
  pendingBoxSelect = null
  boxSelecting.value = false
  resetSelectionRect()
  window.removeEventListener('mousemove', handleBoxSelectMove)
  window.removeEventListener('mouseup', stopBoxSelect)
}

const startBoxSelect = (event) => {
  if (event.button !== 0 || isInteractiveSelectTarget(event.target)) return
  selectionStart.x = event.clientX
  selectionStart.y = event.clientY
  pendingBoxSelect = true
  window.addEventListener('mousemove', handleBoxSelectMove)
  window.addEventListener('mouseup', stopBoxSelect)
}

const submitCityBinding = async () => {
  if (!bindCityId.value || !currentFolderId.value) return
  bindingCity.value = true
  try {
    await bindCityMaterialFolder(bindCityId.value, { folder_id: currentFolderId.value })
    ElMessage.success('城市素材文件夹已绑定')
    bindCityId.value = ''
    await loadCities()
  } catch (e) {
    ElMessage.error('绑定失败：' + getErrorMessage(e))
  } finally {
    bindingCity.value = false
  }
}

const openFolderDialog = (folder = null, parentFolder = null) => {
  folderForm.id = folder?.id || ''
  folderForm.name = folder?.name || ''
  folderForm.parentId = folder?.id ? '' : (parentFolder?.id || currentFolderId.value)
  folderDialogVisible.value = true
}

const openSiblingFolderDialog = (folder = currentFolder.value) => {
  if (isTreeRoot(folder)) return openFolderDialog(null, folder)
  if (isRootFolder(folder)) return openFolderDialog(null, { id: TREE_ROOT_ID, path: '/' })
  if (!canCreateSiblingFor(folder)) return ElMessage.warning('当前目录不能创建同级文件夹')
  if (!folder.parent_id) return openFolderDialog(null, { id: TREE_ROOT_ID, path: '/' })
  openFolderDialog(null, { id: folder.parent_id })
}

const closeFolderDialog = () => {
  folderDialogVisible.value = false
  folderForm.id = ''
  folderForm.name = ''
  folderForm.parentId = ''
}

const submitFolder = async () => {
  const name = String(folderForm.name || '').trim()
  if (!name) return
  try {
    if (folderForm.id) {
      await updateMaterialFolder(folderForm.id, { name })
      ElMessage.success('文件夹已更新')
    } else {
      const parentId = folderForm.parentId || currentFolderId.value
      await createMaterialFolder({ name, parent_id: parentId })
      ElMessage.success('文件夹已创建')
    }
    closeFolderDialog()
    await loadFolderTree()
  } catch (e) {
    ElMessage.error((folderForm.id ? '更新失败：' : '创建失败：') + (e.message || '未知错误'))
  }
}

const removeFolder = async (folder) => {
  if (!folder || isSystemFolder(folder)) return ElMessage.warning('系统文件夹不能删除')
  try {
    await ElMessageBox.confirm(`确认删除文件夹「${folder.name}」吗？只有空文件夹可以删除。`, '删除文件夹', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }
  try {
    await deleteMaterialFolder(folder.id)
    ElMessage.success('文件夹已删除')
    if (currentFolderId.value === folder.id) {
      currentFolderId.value = folder.parent_id || ROOT_FOLDER_ID
      selectedFile.value = null
      clearSelection()
      await Promise.all([loadFolderTree(), loadFiles()])
    } else {
      await loadFolderTree()
    }
  } catch (e) {
    ElMessage.error('删除失败：' + (e.message || '未知错误'))
  }
}

const pickFile = () => {
  if (!canUploadToCurrent.value) return ElMessage.warning('请选择普通文件夹后再上传')
  fileInputRef.value?.click()
}

const handleDragOver = () => {
  if (!canUploadToCurrent.value) return
  isDragging.value = true
}

const handleFilePick = (event) => {
  const files = event.target.files ? Array.from(event.target.files) : []
  if (files.length) uploadFiles(files)
  event.target.value = ''
}

const collectEntryFiles = (entry) => new Promise((resolve) => {
  if (!entry) return resolve([])
  if (entry.isFile) {
    entry.file(file => resolve([file]), () => resolve([]))
    return
  }
  if (!entry.isDirectory) return resolve([])
  const reader = entry.createReader()
  const batches = []
  const readBatch = () => {
    reader.readEntries(async (entries) => {
      if (!entries.length) {
        const nested = await Promise.all(batches.flat().map(collectEntryFiles))
        resolve(nested.flat())
        return
      }
      batches.push(entries)
      readBatch()
    }, () => resolve([]))
  }
  readBatch()
})

const getDroppedFiles = async (dataTransfer) => {
  const items = Array.from(dataTransfer?.items || [])
  const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean)
  if (entries.length) {
    const files = (await Promise.all(entries.map(collectEntryFiles))).flat()
    if (files.length) return files
  }
  return dataTransfer?.files ? Array.from(dataTransfer.files) : []
}

const handleDrop = async (event) => {
  isDragging.value = false
  if (!canUploadToCurrent.value) return ElMessage.warning('请选择普通文件夹后再上传')
  const files = await getDroppedFiles(event.dataTransfer)
  if (files.length) uploadFiles(files)
}

const handleFolderDrop = async (event, folder) => {
  if (!canUploadToFolder(folder)) return ElMessage.warning('系统目录不能上传，请选择普通文件夹')
  const files = await getDroppedFiles(event.dataTransfer)
  if (!files.length) return
  await uploadFiles(files, folder)
}

const uploadFiles = async (files, targetFolder = currentFolder.value) => {
  if (!canUploadToFolder(targetFolder)) return ElMessage.warning('请选择普通文件夹后再上传')
  const folder = {
    id: String(targetFolder.id || ''),
    path: String(targetFolder.path || '/'),
    storage_policy_id: targetFolder.storage_policy_id || 'default'
  }
  const filesArr = Array.from(files).filter(file => isSupportedMaterial({ name: file.name, mime: file.type }))
  if (!filesArr.length) return ElMessage.warning('请选择视频、图片、压缩包或文档上传')
  const uploadTypeId = selectedTypeId.value || ''
  const uploadTypeName = currentTypeName.value

  const fileConcurrency = filesArr.length > 1 ? 2 : 1
  const multipartAsyncLimit = filesArr.length > 1 ? 2 : 3

  await runUploadQueue(filesArr, fileConcurrency, async (file) => {
    const startedAt = Date.now()
    const queueItem = reactive({
      tempId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      folderId: folder.id,
      folderPath: folder.path,
      loaded: 0,
      total: Number(file.size || 0),
      lastLoaded: 0,
      lastProgressAt: startedAt,
      speedBytesPerSecond: 0,
      percent: 0,
      speedText: '',
      remainingText: '',
      msg: '准备上传',
      status: 'pending'
    })
    uploadingQueue.push(queueItem)
    try {
      const storageProvider = getActiveStorageProvider()
      const storageClient = storageProvider === 'upyun' ? upyun : cos
      const uploadRes = await storageClient.uploadFile(file, {
        folderPath: folder.path,
        typeName: uploadTypeName,
        multipartThreshold: shouldMultipartUpload(file) ? 8 * 1024 * 1024 : Number.MAX_SAFE_INTEGER,
        sliceSize: 8 * 1024 * 1024,
        asyncLimit: multipartAsyncLimit,
        onProgress: (progress) => {
          if (progress.fallback) {
            queueItem.percent = 1
            queueItem.loaded = 0
            queueItem.speedText = ''
            queueItem.remainingText = ''
            queueItem.msg = '分片确认较慢，改用普通上传'
            queueItem.status = 'uploading'
            return
          }
          const loaded = Number(progress.loaded || 0)
          const total = Number(progress.total || file.size || 0)
          const now = Date.now()
          const deltaBytes = Math.max(0, loaded - Number(queueItem.lastLoaded || 0))
          const deltaSeconds = Math.max(0.1, (now - Number(queueItem.lastProgressAt || startedAt)) / 1000)
          const instantSpeed = deltaBytes > 0 ? deltaBytes / deltaSeconds : Number(queueItem.speedBytesPerSecond || 0)
          const speed = queueItem.speedBytesPerSecond
            ? queueItem.speedBytesPerSecond * 0.65 + instantSpeed * 0.35
            : instantSpeed
          queueItem.percent = Math.max(1, progress.percent)
          queueItem.loaded = loaded
          queueItem.total = total
          queueItem.lastLoaded = loaded
          queueItem.lastProgressAt = now
          queueItem.speedBytesPerSecond = speed
          queueItem.speedText = formatUploadSpeed(speed)
          queueItem.remainingText = loaded < total && speed > 0 ? formatRemainingTime((total - loaded) / speed) : ''
          queueItem.msg = progress.percent < 100 ? '上传中' : '上传确认中'
          queueItem.status = 'uploading'
        }
      })
      queueItem.msg = '写入素材记录'
      queueItem.status = 'saving'
      const payload = {
        name: file.name,
        size: file.size,
        key: uploadRes.key,
        object_key: uploadRes.key,
        url: uploadRes.url,
        type_name: uploadTypeName,
        video_type_id: uploadTypeId || undefined,
        date: dayjs().format('YYYY-MM-DD'),
        duration: null,
        mime: file.type || '',
        folder_id: folder.id,
        folder_path: folder.path,
        storage_policy_id: folder.storage_policy_id || 'default',
        storage_provider: storageProvider,
        source: storageProvider
      }
      const resp = await createMaterialFile(payload)
      queueItem.percent = 100
      queueItem.loaded = queueItem.total
      queueItem.remainingText = ''
      queueItem.msg = '上传完成'
      queueItem.status = 'done'
      if (String(currentFolderId.value) === String(folder.id)) {
        const uploadedFile = normalizeFile({ ...payload, ...resp, id: resp?.id, cos_key: uploadRes.key, object_key: uploadRes.object_key || uploadRes.key, storage_provider: storageProvider, created_at: dayjs().format('YYYY-MM-DD HH:mm:ss') })
        fileList.value.unshift(uploadedFile)
        if (canInlinePreview(uploadedFile)) await ensureMediaPreviewUrl(uploadedFile).catch(() => {})
        await loadFiles()
      }
    } catch (e) {
      queueItem.msg = '上传失败'
      queueItem.status = 'failed'
      ElMessage.error(`「${file.name}」上传失败：${e.message || '未知错误'}`)
    } finally {
      setTimeout(() => {
        const index = uploadingQueue.findIndex(item => item.tempId === queueItem.tempId)
        if (index >= 0) uploadingQueue.splice(index, 1)
      }, queueItem.status === 'failed' ? 6000 : 1800)
    }
  })
  await Promise.all([loadFolderTree(), loadUploadStats()])
}

const isVideo = (file) => {
  if (!file) return false
  const mime = String(file.mime || '').toLowerCase()
  if (mime.startsWith('video/')) return true
  const ext = String(file.name || '').split('.').pop().toLowerCase()
  return ['mp4', 'mov', 'm4v', 'webm', 'flv', 'mkv'].includes(ext)
}

const getFileExt = (file) => String(file?.name || '').split('.').pop().toLowerCase()

const isImage = (file) => {
  if (!file) return false
  const mime = String(file.mime || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'].includes(getFileExt(file))
}

const isArchive = (file) => ['zip', 'rar', '7z', 'tar', 'gz'].includes(getFileExt(file))
const isDocumentFile = (file) => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'].includes(getFileExt(file))
const isSupportedMaterial = (file) => isVideo(file) || isImage(file) || isArchive(file) || isDocumentFile(file)
const shouldMultipartUpload = (file) => isVideo(file) || Number(file?.size || 0) >= 50 * 1024 * 1024

const canInlinePreview = (file) => isVideo(file) || isImage(file)

const getFileKindLabel = (file) => {
  if (isVideo(file)) return '视频'
  if (isImage(file)) return '图片'
  if (isArchive(file)) return '压缩包'
  if (isDocumentFile(file)) return '文档'
  return '文件'
}

const getFileIcon = (file) => {
  if (isVideo(file)) return VideoCamera
  if (isImage(file)) return Picture
  if (isArchive(file)) return Box
  if (isDocumentFile(file)) return Document
  return Files
}

const getPreviewKey = (file) => file?.id || file?.key || file?.url || ''
const getMediaPreviewUrl = (file) => mediaPreviewUrls.value[getPreviewKey(file)] || file?.url || ''
const toAbsoluteUrl = (url) => {
  if (!url) return ''
  try {
    return new URL(url, window.location.origin).toString()
  } catch {
    return url
  }
}
const getErrorMessage = (e, fallback = '未知错误') => e?.response?.data?.message || e?.message || fallback

const ensureMediaPreviewUrl = async (file) => {
  if (!canInlinePreview(file) || (!file?.url && !file?.key) || previewErrorKeys.value[getPreviewKey(file)]) return ''
  const key = getPreviewKey(file)
  if (mediaPreviewUrls.value[key]) return mediaPreviewUrls.value[key]
  const { previewUrl } = await createMediaPreviewToken(file)
  mediaPreviewUrls.value = { ...mediaPreviewUrls.value, [key]: previewUrl || file.url }
  return mediaPreviewUrls.value[key]
}

const markPreviewError = (file) => {
  previewErrorKeys.value = { ...previewErrorKeys.value, [getPreviewKey(file)]: true }
}

const openPreview = async (file) => {
  if (!file?.url && !file?.key) return ElMessage.warning('该素材暂无可访问链接')
  previewFile.value = file
  previewError.value = false
  if (canInlinePreview(file)) {
    try {
      await ensureMediaPreviewUrl(file)
    } catch {
      previewError.value = !file.url
    }
  }
  previewVisible.value = true
}

const closePreview = () => {
  previewVisible.value = false
  previewError.value = false
  setTimeout(() => { previewFile.value = null }, 200)
}

const onPreviewError = () => {
  previewError.value = true
}

const openRename = (file) => {
  renameTarget.value = file
  renameForm.name = file.name
  renameVisible.value = true
}

const closeRename = () => {
  renameVisible.value = false
  renameTarget.value = null
  renameForm.name = ''
}

const confirmRename = async () => {
  const target = renameTarget.value
  const name = String(renameForm.name || '').trim()
  if (!target || !name) return
  try {
    await updateMaterialFile(target.id, { name })
    target.name = name
    ElMessage.success('文件已重命名')
    closeRename()
  } catch (e) {
    ElMessage.error('重命名失败：' + (e.message || '未知错误'))
  }
}

const openMoveDialog = (files = []) => {
  const source = Array.isArray(files) ? files : [files]
  const uniqueFiles = Array.from(new Map(source.filter(file => file?.id).map(file => [file.id, file])).values())
  if (!uniqueFiles.length) return ElMessage.warning('请先选择要移动的素材')
  moveTargetFiles.value = uniqueFiles
  moveTargetFolderId.value = ''
  moveVisible.value = true
}

const closeMoveDialog = () => {
  if (movingFiles.value) return
  moveVisible.value = false
  moveTargetFiles.value = []
  moveTargetFolderId.value = ''
}

const confirmMoveFiles = async () => {
  const targetFolder = selectedMoveFolder.value
  if (!targetFolder) return ElMessage.warning('请选择目标文件夹')
  const filesToMove = moveTargetFiles.value.filter(file => String(file.folder_id || '') !== String(targetFolder.id))
  if (!filesToMove.length) return ElMessage.warning('选中的素材已经在目标文件夹')

  movingFiles.value = true
  const failures = []
  try {
    for (const file of filesToMove) {
      try {
        await updateMaterialFile(file.id, {
          folder_id: targetFolder.id,
          folder_path: targetFolder.path
        })
      } catch (e) {
        failures.push(`「${file.name}」${getErrorMessage(e, '移动失败')}`)
      }
    }
    if (failures.length) {
      ElMessage.warning(`有 ${failures.length} 个素材移动失败`)
    }
    if (filesToMove.length > failures.length) {
      ElMessage.success(`已移动 ${filesToMove.length - failures.length} 个素材到 ${targetFolder.path}`)
    }
    moveVisible.value = false
    moveTargetFiles.value = []
    moveTargetFolderId.value = ''
    selectedFile.value = null
    clearSelection()
    await Promise.all([loadFolderTree(), loadFiles()])
  } finally {
    movingFiles.value = false
  }
}

const getShareUrl = async (file) => {
  if (!file?.url && !file?.key) return ''
  const { shareUrl } = await createMediaShareToken(file)
  return toAbsoluteUrl(shareUrl)
}

const getDownloadUrl = async (file) => {
  if (!file?.url && !file?.key) return ''
  try {
    const { previewUrl } = await createMediaPreviewToken(file)
    return toAbsoluteUrl(previewUrl || file.url)
  } catch {
    return toAbsoluteUrl(file.url)
  }
}

const shareFile = async (file) => {
  try {
    const url = await getShareUrl(file)
    if (!url) return ElMessage.warning('该文件暂无可分享链接')
    await navigator.clipboard.writeText(url)
    ElMessage.success('分享链接已复制')
  } catch (e) {
    ElMessage.error('短分享链接生成失败：' + getErrorMessage(e))
  }
}

const copyLink = shareFile

const shareSelectedFiles = async () => {
  if (!selectedFiles.value.length) return ElMessage.warning('请先选择素材')
  const rows = []
  for (const file of selectedFiles.value) {
    try {
      const url = await getShareUrl(file)
      if (url) rows.push(`${file.name}\n${url}`)
    } catch (e) {
      ElMessage.error(`「${file.name}」短分享链接生成失败：${getErrorMessage(e)}`)
    }
  }
  if (!rows.length) return ElMessage.warning('选中的素材暂无可分享链接')
  const text = rows.join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已合并复制 ${rows.length} 个分享链接`)
  } catch {
    ElMessage.info(text)
  }
}

const downloadFile = async (file) => {
  const url = await getDownloadUrl(file)
  if (!url) return ElMessage.warning('该文件暂无可下载链接')
  const a = document.createElement('a')
  a.href = url
  a.download = file.name || 'material'
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const downloadSelectedFiles = async () => {
  if (!selectedFiles.value.length) return ElMessage.warning('请先选择素材')
  for (const file of selectedFiles.value) {
    await downloadFile(file)
    await new Promise(resolve => setTimeout(resolve, 180))
  }
}

const removeSelectedItems = async () => {
  if (!selectedItemCount.value) return ElMessage.warning('请先选择素材')
  const systemFolders = selectedFolders.value.filter(isSystemFolder)
  const folders = selectedFolders.value.filter(folder => !isSystemFolder(folder))
  const files = [...selectedFiles.value]
  const parts = []
  if (files.length) parts.push(`${files.length} 个素材`)
  if (folders.length) parts.push(`${folders.length} 个文件夹`)
  if (systemFolders.length) parts.push(`${systemFolders.length} 个系统文件夹将跳过`)

  try {
    await ElMessageBox.confirm(`确认删除已选 ${parts.join('、')} 吗？文件夹只有为空时才能删除。`, '批量删除素材', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }

  let successCount = 0
  const failures = []

  for (const file of files) {
    try {
      if (file.key) {
        try {
          await deleteCloudObject(file)
        } catch (e) {
          ElMessage.warning(`「${file.name}」云端删除失败，将继续删除记录：${e.message || '未知错误'}`)
        }
      }
      await deleteMaterialFile(file.id)
      successCount += 1
    } catch (e) {
      failures.push(`「${file.name}」${e.message || '删除失败'}`)
    }
  }

  for (const folder of folders) {
    try {
      await deleteMaterialFolder(folder.id)
      successCount += 1
    } catch (e) {
      failures.push(`「${folder.name}」${e.message || '删除失败'}`)
    }
  }

  selectedFile.value = null
  clearSelection()
  await Promise.all([loadFolderTree(), loadFiles()])

  if (successCount) ElMessage.success(`已删除 ${successCount} 项`)
  if (failures.length) ElMessage.warning(`有 ${failures.length} 项删除失败，可能文件夹不为空`)
}

const copyPath = async (file) => {
  const text = file?.key || file?.folder_path || ''
  if (!text) return ElMessage.warning('路径为空')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('路径已复制')
  } catch {
    ElMessage.info(text)
  }
}

const removeFile = async (file) => {
  try {
    await ElMessageBox.confirm(`将删除云端文件和系统记录「${file.name}」，确认吗？`, '删除素材', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }
  try {
    if (file.key) await deleteCloudObject(file)
  } catch (e) {
    ElMessage.warning('云端删除失败，将继续删除记录：' + (e.message || '未知错误'))
  }
  try {
    await deleteMaterialFile(file.id)
    fileList.value = fileList.value.filter(item => item.id !== file.id)
    selectedFileIds.value = selectedFileIds.value.filter(id => id !== file.id)
    if (selectedFile.value?.id === file.id) selectedFile.value = null
    ElMessage.success('素材已删除')
    await loadFolderTree()
  } catch (e) {
    ElMessage.error('记录删除失败：' + (e.message || '未知错误'))
  }
}

const formatBytes = (bytes) => {
  const value = Number(bytes || 0)
  if (!value || value < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const formatTime = (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

onErrorCaptured((err) => {
  console.error('[MaterialEntry] 页面渲染异常:', err)
  ElMessage.error('素材录入页面出现异常，请刷新后重试')
  return false
})

onMounted(() => {
  loadAll()
  window.addEventListener('click', closeFolderContextMenu)
  window.addEventListener('resize', closeFolderContextMenu)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleBoxSelectMove)
  window.removeEventListener('mouseup', stopBoxSelect)
  window.removeEventListener('click', closeFolderContextMenu)
  window.removeEventListener('resize', closeFolderContextMenu)
})
</script>

<style scoped>
.material-library {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 96px);
  min-height: 620px;
  min-width: 0;
  overflow: hidden;
  color: #18202f;
  background:
    linear-gradient(180deg, rgba(237, 248, 251, .56), rgba(248, 250, 252, 0) 220px);
}

.library-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1f8a70;
}

.library-topbar h1 {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.15;
  letter-spacing: 0;
}

.topbar-actions,
.content-tools,
.content-head-actions,
.detail-actions,
.dialog-foot {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-btn,
.ghost-btn,
.tool-btn,
.icon-btn,
.pane-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #d8dee9;
  background: #fff;
  color: #273449;
  padding: 0 13px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn.solid,
.primary-btn:hover {
  border-color: #176b87;
  background: #176b87;
  color: #fff;
}

button:disabled {
  cursor: not-allowed;
  opacity: .48;
}

.icon-btn,
.tool-btn {
  width: 36px;
  padding: 0;
}

.pane-action-btn {
  min-width: 0;
  height: 36px;
  padding: 0 9px;
  font-size: 12px;
}

.tool-btn.active {
  color: #176b87;
  border-color: #a5c6d4;
  background: #edf8fb;
}

.storage-strip {
  display: grid;
  grid-template-columns: minmax(240px, 1.6fr) repeat(4, minmax(118px, .55fr));
  gap: 10px;
  margin-bottom: 12px;
}

.upload-stat-panel {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  border: 1px solid #dbe7ec;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.upload-stat-panel.compact {
  flex: 0 0 auto;
  margin: 0;
  border-width: 0 0 1px;
  border-radius: 0;
  box-shadow: none;
  padding: 10px 14px;
  background: linear-gradient(180deg, #fff, #fbfcfe);
}

.upload-stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.upload-stat-head strong,
.upload-stat-head span {
  display: block;
}

.upload-stat-head strong {
  color: #111827;
  font-size: 15px;
  font-weight: 900;
}

.upload-stat-head span {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
}

.upload-stat-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.month-input {
  width: 140px;
  height: 32px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  color: #273449;
  padding: 0 10px;
  font-weight: 700;
}

.upload-stat-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.upload-stat-card {
  display: grid;
  grid-template-columns: minmax(70px, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
  flex: 0 0 142px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fbfc;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.upload-stat-card:hover,
.upload-stat-card.active {
  border-color: #176b87;
  background: #edf8fb;
}

.upload-stat-card span,
.upload-stat-card em {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-stat-card span {
  color: #273449;
  font-weight: 800;
}

.upload-stat-card strong {
  grid-row: span 2;
  color: #176b87;
  font-size: 20px;
  line-height: 1.05;
  text-align: right;
}

.upload-stat-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  padding: 12px;
  text-align: center;
  font-size: 13px;
}

.storage-item {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: linear-gradient(180deg, #fff, #f8fbfc);
  padding: 11px 13px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.storage-item span,
.pane-head span,
.content-head span,
.detail-head span,
.file-main span,
.folder-card em,
.upload-box span {
  display: block;
  color: #718096;
  font-size: 12px;
}

.storage-item strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #111827;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
}

.folder-pane,
.content-pane,
.detail-pane,
.upload-panel,
.info-panel {
  min-width: 0;
}

.folder-pane,
.content-pane,
.detail-pane > section {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.folder-pane,
.content-pane {
  overflow: hidden;
}

.content-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.folder-pane {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.detail-pane {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 12px;
  overflow: hidden;
}

.detail-head,
.content-head,
.pathbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pane-head {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #edf2f7;
}

.pane-head > div:first-child {
  min-width: 0;
}

.pane-head strong,
.pane-head span {
  display: block;
}

.pane-head strong {
  color: #111827;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.25;
}

.pane-head span {
  margin-top: 4px;
  line-height: 1.45;
}

.pane-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.folder-finder {
  min-height: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #edf2f7;
}

.folder-search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #f8fafc;
  padding: 0 9px;
}

.folder-search-box input {
  min-width: 0;
  flex: 1 1 auto;
  border: 0;
  outline: 0;
  background: transparent;
  color: #111827;
  font: inherit;
  font-size: 13px;
}

.folder-search-box button {
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.folder-search-results {
  display: grid;
  gap: 6px;
  max-height: 148px;
  overflow: auto;
  margin-top: 8px;
}

.folder-search-results button {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 7px 9px;
  text-align: left;
  cursor: pointer;
}

.folder-search-results button:hover {
  border-color: #a5c6d4;
  background: #edf8fb;
}

.folder-search-results strong,
.folder-search-results span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-search-results strong {
  color: #111827;
  font-size: 13px;
}

.folder-search-results span,
.folder-search-empty {
  margin-top: 2px;
  color: #718096;
  font-size: 12px;
}

.folder-search-empty {
  padding: 8px 2px;
}

.tree-wrap {
  min-height: 0;
  overflow: auto;
  padding: 8px 8px 18px;
}

.tree-wrap :deep(.el-tree-node__content) {
  min-width: 0;
}

.tree-wrap :deep(.el-tree-node__label) {
  min-width: 0;
  flex: 1;
}

.tree-node {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  font-size: 13px;
}

.tree-node.droppable {
  border-radius: 6px;
  padding: 2px 4px;
}

.tree-node.droppable:hover {
  background: #edf8fb;
  color: #176b87;
}

.tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node em {
  min-width: 22px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  padding: 1px 7px;
  text-align: center;
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
}

.tree-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  width: 0;
  justify-content: flex-end;
  overflow: hidden;
  opacity: 0;
  transition: opacity .16s ease;
}

.tree-node:hover .tree-actions,
.tree-node:focus-within .tree-actions {
  width: 98px;
  opacity: 1;
}

.tree-actions button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid #d8dee9;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.tree-actions button:hover {
  border-color: #a5c6d4;
  color: #176b87;
}

.tree-actions button.danger:hover {
  border-color: #fecaca;
  color: #d92d20;
}

.folder-context-menu {
  position: fixed;
  z-index: 3200;
  width: 156px;
  padding: 6px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
}

.folder-context-menu button {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.folder-context-menu button:hover {
  color: #176b87;
  background: #edf8fb;
}

.folder-context-menu button.danger {
  color: #dc2626;
}

.folder-context-menu button.danger:hover {
  color: #b91c1c;
  background: #fef2f2;
}

.pathbar {
  min-height: 52px;
  padding: 8px 14px;
  border-bottom: 1px solid #edf2f7;
  flex-wrap: wrap;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.breadcrumbs button {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #667085;
  padding: 6px 18px 6px 0;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumbs button::after {
  content: "/";
  position: absolute;
  right: 6px;
  color: #cbd5e1;
}

.breadcrumbs button.active {
  color: #111827;
}

.breadcrumbs button.active::after {
  content: "";
}

.storage-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.storage-pills span {
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  min-height: 26px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.storage-pills .path-pill {
  overflow: hidden;
  text-overflow: ellipsis;
}

.storage-pills b {
  margin-left: 4px;
  color: #111827;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 220px;
  height: 36px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  padding: 0 10px;
  background: #f8fafc;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #111827;
}

.drop-surface {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  overflow: auto;
  padding: 14px;
  background: #fbfcfe;
}

.drop-surface.dragging {
  outline: 2px solid #176b87;
  outline-offset: -6px;
  background: #f0fafc;
}

.content-head {
  margin-bottom: 12px;
}

.content-head-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.content-head strong,
.detail-head strong {
  display: block;
  font-size: 15px;
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  padding: 3px;
}

.selection-bar:has(.select-btn:only-child) {
  border-color: transparent;
  background: transparent;
  padding: 0;
}

.selection-bar span {
  padding: 0 5px;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.select-btn:hover,
.select-btn.active {
  background: #edf8fb;
  color: #176b87;
}

.select-btn.danger {
  color: #b42318;
}

.select-btn.danger:hover {
  background: #fff1f0;
  color: #d92d20;
}

.sort-tabs {
  display: flex;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.sort-tabs button {
  height: 32px;
  border: 0;
  border-right: 1px solid #e5e7eb;
  background: transparent;
  padding: 0 12px;
  color: #64748b;
  cursor: pointer;
}

.sort-tabs button:last-child {
  border-right: 0;
}

.sort-tabs button.active {
  background: #176b87;
  color: #fff;
}

.folder-bind-inline {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 360px;
  min-height: 34px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  padding: 3px;
}

.folder-bind-inline > span {
  min-width: 0;
  max-width: 120px;
  overflow: hidden;
  color: #64748b;
  padding: 0 5px;
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-drawer {
  width: min(420px, 100vw);
  height: 100%;
  max-height: none;
  border-radius: 0;
  border: 0;
  border-left: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 14px;
  box-shadow: -18px 0 42px rgba(15, 23, 42, .18);
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.drawer-head strong,
.drawer-head span {
  display: block;
}

.drawer-head strong {
  color: #111827;
  font-size: 17px;
  font-weight: 900;
}

.drawer-head span {
  max-width: 300px;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-upload-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
  width: min(460px, calc(100vw - 48px));
  overflow: hidden;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
}

.floating-upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #f8fbff;
}

.floating-upload-head strong,
.floating-upload-head span {
  display: block;
}

.floating-upload-head strong {
  color: #111827;
  font-size: 14px;
  font-weight: 900;
}

.floating-upload-head span {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
}

.floating-upload-head button {
  flex: 0 0 auto;
  height: 30px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #fff;
  color: #4f46e5;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.floating-upload-body {
  display: grid;
  max-height: 320px;
  overflow-y: auto;
  gap: 8px;
  padding: 10px;
}

.floating-upload-panel.collapsed {
  width: min(320px, calc(100vw - 48px));
}

.queue-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 40px;
  gap: 10px;
  align-items: center;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
  padding: 10px;
}

.queue-row.done {
  border-color: #bbf7d0;
  background: #f7fef9;
}

.queue-row.failed {
  border-color: #fecaca;
  background: #fff7f7;
}

.queue-row strong,
.queue-row span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-row span {
  color: #64748b;
  font-size: 12px;
}

.queue-row small {
  display: block;
  color: #94a3b8;
  font-size: 11px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-row em {
  color: #176b87;
  font-style: normal;
  font-size: 12px;
  font-weight: 800;
}

.queue-row.done em {
  color: #059669;
}

.queue-row.failed em {
  color: #dc2626;
}

.progress-line {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}

.progress-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #176b87;
  transition: width .2s ease;
}

.asset-area.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.asset-area.selecting {
  user-select: none;
}

.selection-rect {
  position: fixed;
  z-index: 2100;
  border: 1px solid #176b87;
  border-radius: 6px;
  background: rgba(23, 107, 135, .12);
  pointer-events: none;
}

.asset-area.list {
  display: grid;
  gap: 8px;
}

.folder-card,
.file-card {
  position: relative;
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  text-align: left;
}

.folder-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  column-gap: 10px;
  align-items: center;
  min-height: 96px;
  padding: 12px;
  cursor: pointer;
}

.folder-card:focus-visible,
.folder-card:hover {
  outline: none;
}

.folder-card:hover,
.file-card:hover,
.folder-card.selected,
.file-card.selected,
.file-card.checked {
  border-color: #91b8c7;
  box-shadow: 0 8px 20px rgba(23, 107, 135, .08);
}

.folder-card.selected,
.file-card.checked {
  background: #f7fbfc;
}

.select-mark {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.select-mark input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.select-mark span {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: rgba(255, 255, 255, .96);
  color: transparent;
  font-size: 12px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, .08);
}

.select-mark input:checked + span {
  border-color: #176b87;
  background: #176b87;
  color: #fff;
}

.folder-icon {
  display: grid;
  grid-row: 1 / span 3;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #edf8fb;
  color: #176b87;
  font-size: 20px;
}

.folder-card strong,
.file-main strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-meta-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 4px;
}

.folder-meta-strip small {
  min-width: 0;
  overflow: hidden;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-actions,
.file-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.folder-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  opacity: 0;
}

.folder-card:hover .folder-actions {
  opacity: 1;
}

.folder-actions button,
.file-actions button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}

.file-actions button:hover,
.folder-actions button:hover {
  color: #176b87;
  border-color: #a5c6d4;
}

.file-actions button.danger:hover,
.folder-actions button.danger:hover {
  color: #d92d20;
  border-color: #fecaca;
}

.file-card {
  overflow: hidden;
  cursor: pointer;
}

.asset-area.grid .file-card {
  display: grid;
  grid-template-rows: 150px auto auto;
}

.asset-area.list .file-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 76px;
}

.thumb {
  position: relative;
  overflow: hidden;
  min-width: 0;
  background: #eef2f7;
}

.asset-area.grid .thumb {
  height: 150px;
}

.asset-area.list .thumb {
  height: 76px;
}

.thumb video,
.thumb img,
.detail-preview video,
.detail-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-fallback,
.detail-preview {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #176b87;
  font-size: 32px;
}

.thumb-fallback {
  align-content: center;
  gap: 7px;
  background:
    linear-gradient(135deg, rgba(23, 107, 135, .08), rgba(99, 102, 241, .06));
}

.thumb-fallback span {
  border-radius: 999px;
  background: rgba(255, 255, 255, .86);
  color: #475569;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 800;
}

.play-btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  background: rgba(17, 24, 39, .76);
  color: #fff;
  cursor: pointer;
  font-size: 18px;
  opacity: .92;
  transition: opacity .16s ease, transform .16s ease, background .16s ease;
}

.file-card:hover .play-btn {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.04);
  background: rgba(23, 107, 135, .9);
}

.file-main {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
}

.file-main strong,
.file-main span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-main em {
  width: fit-content;
  max-width: 100%;
  overflow: hidden;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  padding: 3px 7px;
  font-style: normal;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-main .usage-chip {
  background: #e0f2fe;
  color: #0369a1;
}
.file-main .usage-chip.unused {
  background: #f1f5f9;
  color: #64748b;
}
.file-main .usage-chip.failed {
  background: #fee2e2;
  color: #b91c1c;
}

.asset-area.grid .file-actions {
  flex-wrap: wrap;
  align-content: flex-start;
  padding: 0 10px 10px;
}

.asset-area.list .file-actions {
  flex-wrap: nowrap;
  padding-right: 10px;
}

.empty-state,
.tree-empty {
  display: grid;
  place-items: center;
  align-content: center;
  min-height: 360px;
  color: #64748b;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: #edf8fb;
  color: #176b87;
  font-size: 30px;
}

.empty-state strong {
  color: #111827;
  font-size: 16px;
}

.empty-state p {
  margin: 6px 0 16px;
}

.upload-panel,
.info-panel {
  padding: 14px;
}

.type-select {
  margin-top: 14px;
}

.type-select label,
.field-label {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.upload-box {
  display: grid;
  place-items: center;
  gap: 7px;
  width: 100%;
  min-height: 126px;
  margin-top: 14px;
  border: 1px dashed #9db8c2;
  border-radius: 8px;
  background: #f7fbfc;
  color: #176b87;
  cursor: pointer;
}

.upload-box .el-icon {
  font-size: 28px;
}

.info-panel {
  overflow: auto;
}

.file-detail h3,
.folder-detail h3 {
  margin: 12px 0;
  color: #111827;
  font-size: 17px;
  word-break: break-all;
}

.detail-preview {
  height: 170px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 8px;
  background: #eef2f7;
  cursor: pointer;
}

.big-folder {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin-top: 18px;
  border-radius: 12px;
  background: #edf8fb;
  color: #176b87;
  font-size: 34px;
}

.folder-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.folder-admin-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  color: #273449;
  padding: 0 10px;
  font-weight: 700;
  cursor: pointer;
}

.folder-admin-actions button:hover {
  border-color: #a5c6d4;
  color: #176b87;
}

.folder-admin-actions button.danger:hover {
  border-color: #fecaca;
  color: #d92d20;
}

.bind-city-box {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  border-top: 1px solid #edf2f7;
  padding-top: 14px;
}

.bind-city-box label {
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.bind-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.bind-city-box p {
  margin: 0;
  color: #176b87;
  font-size: 12px;
  line-height: 1.5;
}

dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

dl div {
  display: grid;
  gap: 3px;
}

dt {
  color: #718096;
  font-size: 12px;
}

dd {
  min-width: 0;
  margin: 0;
  color: #1f2937;
  font-size: 13px;
  word-break: break-all;
}

.detail-actions {
  margin-top: 14px;
}

.detail-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  padding: 0 12px;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, .42);
  padding: 18px;
}

.dialog-overlay.detail-drawer-overlay {
  place-items: stretch end;
  padding: 0;
}

.dialog-card {
  width: min(760px, 96vw);
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .25);
}

.dialog-card.small {
  width: min(430px, 96vw);
}

.preview-card {
  width: min(900px, 96vw);
}

.move-card {
  width: min(620px, 96vw);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #edf2f7;
}

.dialog-head h3,
.dialog-head p {
  margin: 0;
}

.dialog-head p {
  color: #64748b;
  font-size: 13px;
}

.dialog-body,
.dialog-foot {
  padding: 16px;
}

.dialog-hint {
  margin: 0 0 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 9px 11px;
  font-size: 12px;
  font-weight: 700;
}

.dialog-foot {
  justify-content: flex-end;
  border-top: 1px solid #edf2f7;
}

.inline-input {
  width: 100%;
  height: 40px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  outline: none;
  padding: 0 12px;
}

.inline-input:focus {
  border-color: #176b87;
}

.move-summary {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  padding: 12px;
}

.move-summary span {
  color: #64748b;
  font-size: 12px;
}

.move-summary strong {
  color: #1d4ed8;
  font-size: 17px;
}

.move-summary em {
  min-width: 0;
  overflow: hidden;
  color: #475569;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.move-file-list {
  display: grid;
  gap: 6px;
  max-height: 150px;
  overflow: auto;
  margin-bottom: 14px;
}

.move-file-list span {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #fff;
  color: #273449;
  padding: 8px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.preview-body {
  background: #0f172a;
}

.preview-video {
  display: block;
  width: 100%;
  max-height: 70vh;
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  background: #0f172a;
}

.preview-other {
  display: grid;
  place-items: center;
  min-height: 360px;
  color: #fff;
  text-decoration: none;
}

@media (max-width: 1280px) {
  .library-shell {
    grid-template-columns: 230px minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .material-library {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .library-topbar {
    gap: 12px;
  }
  .library-topbar h1 {
    font-size: 30px;
  }
  .topbar-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 8px;
    overflow: visible;
  }
  .topbar-actions button {
    width: 100%;
    min-width: 0;
  }
  .library-topbar,
  .pathbar,
  .content-head {
    align-items: stretch;
    flex-direction: column;
  }
  .storage-strip,
  .upload-stat-head,
  .library-shell {
    grid-template-columns: 1fr;
  }
  .upload-stat-head {
    align-items: stretch;
    flex-direction: column;
  }
  .upload-stat-controls {
    width: 100%;
    flex-wrap: wrap;
  }
  .month-input {
    flex: 1 1 140px;
  }
  .library-shell {
    height: auto;
    min-height: 0;
  }
  .folder-pane,
  .content-pane {
    min-height: 0;
    overflow: visible;
  }
  .tree-wrap,
  .drop-surface {
    height: auto;
    max-height: none;
    overflow: visible;
  }
  .tree-wrap {
    max-height: 38dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .storage-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .storage-item:first-child {
    grid-column: 1 / -1;
  }
  .content-tools,
  .content-head-actions {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  .asset-area.grid {
    grid-template-columns: 1fr;
  }
  .pathbar {
    height: auto;
    padding: 12px;
  }
  .drop-surface {
    padding: 12px;
  }
  .folder-bind-inline {
    width: 100%;
  }
  .sort-tabs {
    flex: 0 0 auto;
  }
  .search-box {
    width: 100%;
  }
  .folder-bind-inline {
    width: 100%;
    max-width: none;
    flex-wrap: wrap;
  }
  .folder-bind-inline > span {
    max-width: 100%;
  }
  .asset-area.list .file-card {
    grid-template-columns: 88px minmax(0, 1fr);
  }
  .asset-area.list .file-actions {
    grid-column: 1 / -1;
    padding: 0 10px 10px;
  }
  .floating-upload-panel {
    right: 12px;
    bottom: 12px;
    width: calc(100vw - 24px);
  }
  .queue-row {
    grid-template-columns: minmax(0, 1fr) 86px 38px;
  }
}
</style>
