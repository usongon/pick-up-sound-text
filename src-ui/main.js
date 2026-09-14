// Tauri 2 withGlobalTauri nests invoke under .core
console.log('[INIT] window.__TAURI__:', window.__TAURI__);
console.log('[INIT] window.__TAURI__.core:', window.__TAURI__?.core);
console.log('[INIT] window.__TAURI__.event:', window.__TAURI__?.event);
console.log('[INIT] window.__TAURI__.dialog:', window.__TAURI__?.dialog);

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { open } = window.__TAURI__.dialog;

console.log('[INIT] invoke:', typeof invoke);
console.log('[INIT] listen:', typeof listen);
console.log('[INIT] open:', typeof open);

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update tab active state
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}-tab`).style.display = 'block';
    });
});

// File drop zone
const dropZone = document.getElementById('drop-zone');

// Tauri native drag-drop provides real file paths (unlike HTML5 drop)
listen('tauri://drag-drop', (event) => {
    console.log('[DRAG] drop event:', event);
    console.log('[DRAG] payload:', event.payload);
    dropZone.classList.remove('dragover');
    const paths = event.payload.paths;
    if (paths.length > 0) {
        handleFilePath(paths[0]);
    }
});

listen('tauri://drag-enter', (event) => {
    console.log('[DRAG] enter event:', event);
    dropZone.classList.add('dragover');
});

listen('tauri://drag-leave', (event) => {
    console.log('[DRAG] leave event:', event);
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('click', async () => {
    console.log('[CLICK] Drop zone clicked');
    console.log('[CLICK] open function:', typeof open);
    try {
        const filePath = await open({
            multiple: false,
            filters: [{
                name: 'Video',
                extensions: ['mp4', 'mkv', 'avi', 'mov']
            }]
        });
        console.log('[CLICK] Dialog returned:', filePath);
        if (filePath) {
            handleFilePath(filePath);
        }
    } catch (err) {
        console.error('[CLICK] Dialog error:', err);
    }
});

let pendingFilePath = null;

async function handleFilePath(filePath) {
    console.log('File selected:', filePath);
    pendingFilePath = filePath;

    const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
    
    // Clear existing content
    dropZone.textContent = '';
    
    const checkmark = document.createElement('p');
    checkmark.style.color = '#4CAF50';
    checkmark.style.fontWeight = 'bold';
    checkmark.textContent = '✓ 已选择文件';
    
    const fileNameP = document.createElement('p');
    fileNameP.style.fontSize = '14px';
    fileNameP.style.marginTop = '8px';
    fileNameP.textContent = fileName;
    
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.marginTop = '8px';
    hint.textContent = '点击可重新选择';
    
    dropZone.appendChild(checkmark);
    dropZone.appendChild(fileNameP);
    dropZone.appendChild(hint);

    // Show language selection + start button
    document.getElementById('file-config').style.display = 'block';
}

document.getElementById('start-processing-btn').addEventListener('click', async () => {
    if (!pendingFilePath) return;

    const sourceLanguage = document.getElementById('source-language').value;
    const displayName = pendingFilePath.split('/').pop() || pendingFilePath.split('\\').pop();

    try {
        const result = await invoke('start_file_processing', {
            videoPath: pendingFilePath,
            sourceLanguage: sourceLanguage,
        });

        console.log('Processing started, task:', result);

        document.getElementById('file-config').style.display = 'none';
        addTaskToList(displayName);
        startProgressPolling();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error);
    }
});

function addTaskToList(fileName) {
    const taskList = document.getElementById('task-list');
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';

    const fileNameDiv = document.createElement('div');
    fileNameDiv.textContent = `📹 ${fileName}`;

    const progressDiv = document.createElement('div');
    progressDiv.className = 'task-progress';

    const progressBar = document.createElement('div');
    progressBar.className = 'task-progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.backgroundColor = '#2196F3';

    progressDiv.appendChild(progressBar);
    taskItem.appendChild(fileNameDiv);
    taskItem.appendChild(progressDiv);
    taskList.appendChild(taskItem);
}

let progressInterval = null;

function startProgressPolling() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    progressInterval = setInterval(async () => {
        try {
            const info = await invoke('get_processing_progress');
            console.log('[PROGRESS]', info);
            updateProgress(info);

            if (info.state === 'completed' || info.state === 'exported') {
                clearInterval(progressInterval);
                progressInterval = null;
                showExportSection();
            } else if (info.state === 'failed') {
                clearInterval(progressInterval);
                progressInterval = null;
            }
        } catch (error) {
            console.error('Progress polling error:', error);
        }
    }, 1000);
}

function updateProgress(info) {
    const progressBars = document.querySelectorAll('.task-progress-bar');
    progressBars.forEach(bar => {
        bar.style.width = `${info.progress * 100}%`;
        
        // Change color based on state
        if (info.state === 'failed') {
            bar.style.backgroundColor = '#f44336';
        } else if (info.state === 'completed' || info.state === 'exported') {
            bar.style.backgroundColor = '#4CAF50';
        }
    });
    
    // Update or create status text
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(item => {
        let statusDiv = item.querySelector('.task-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.className = 'task-status';
            statusDiv.style.fontSize = '12px';
            statusDiv.style.marginTop = '4px';
            item.appendChild(statusDiv);
        }
        
        if (info.state === 'processing') {
            statusDiv.textContent = `处理中... ${Math.round(info.progress * 100)}%`;
            statusDiv.style.color = '#2196F3';
        } else if (info.state === 'completed') {
            statusDiv.textContent = '✓ 完成';
            statusDiv.style.color = '#4CAF50';
        } else if (info.state === 'failed') {
            statusDiv.textContent = `✗ 失败: ${info.error || '未知错误'}`;
            statusDiv.style.color = '#f44336';
        }
    });
}

// Settings page logic
async function loadConfig() {
    try {
        const config = await invoke('get_config');
        
        // ASR config
        document.getElementById('asr-provider').value = config.asr.provider;
        document.getElementById('asr-file-model').value = config.asr.file_model;
        document.getElementById('asr-realtime-model').value = config.asr.realtime_model;
        document.getElementById('asr-api-key').value = config.asr.api_key;
        document.getElementById('asr-workspace-id').value = config.asr.workspace_id || '';
        
        // Translate config
        document.getElementById('translate-provider').value = config.translate.provider;
        document.getElementById('translate-model').value = config.translate.model;
        document.getElementById('translate-api-key').value = config.translate.api_key;
        document.getElementById('translate-target-lang').value = config.translate.target_lang;
        
        // OSS config (optional)
        if (config.oss) {
            document.getElementById('oss-endpoint').value = config.oss.endpoint || '';
            document.getElementById('oss-bucket').value = config.oss.bucket || '';
            document.getElementById('oss-access-key-id').value = config.oss.access_key_id || '';
            document.getElementById('oss-access-key-secret').value = config.oss.access_key_secret || '';
            document.getElementById('oss-path-prefix').value = config.oss.path_prefix || '';
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

async function saveConfig() {
    const statusDiv = document.getElementById('config-status');
    
    try {
        const config = {
            asr: {
                provider: document.getElementById('asr-provider').value,
                file_model: document.getElementById('asr-file-model').value,
                realtime_model: document.getElementById('asr-realtime-model').value,
                api_key: document.getElementById('asr-api-key').value,
                workspace_id: document.getElementById('asr-workspace-id').value.trim() || null,
            },
            translate: {
                provider: document.getElementById('translate-provider').value,
                model: document.getElementById('translate-model').value,
                api_key: document.getElementById('translate-api-key').value,
                target_lang: document.getElementById('translate-target-lang').value,
            },
            oss: (() => {
                const endpoint = document.getElementById('oss-endpoint').value.trim();
                const bucket = document.getElementById('oss-bucket').value.trim();
                const accessKeyId = document.getElementById('oss-access-key-id').value.trim();
                const accessKeySecret = document.getElementById('oss-access-key-secret').value.trim();
                const pathPrefix = document.getElementById('oss-path-prefix').value.trim();
                
                if (!endpoint && !bucket && !accessKeyId && !accessKeySecret) {
                    return null;
                }
                
                return {
                    endpoint,
                    bucket,
                    access_key_id: accessKeyId,
                    access_key_secret: accessKeySecret,
                    path_prefix: pathPrefix || null,
                };
            })(),
        };
        
        await invoke('save_config', { config });
        
        statusDiv.textContent = '配置已保存';
        statusDiv.className = 'status-message success';
        setTimeout(() => {
            statusDiv.className = 'status-message';
        }, 3000);
    } catch (error) {
        console.error('Failed to save config:', error);
        statusDiv.textContent = '保存失败: ' + error;
        statusDiv.className = 'status-message error';
    }
}

// Load config when settings tab is shown
document.querySelector('[data-tab="settings"]').addEventListener('click', () => {
    loadConfig();
});

// Save config button
document.getElementById('save-config-btn').addEventListener('click', saveConfig);

// Auto-fill default model when translate provider changes
const PROVIDER_DEFAULTS = {
    'openai': 'gpt-3.5-turbo',
    'dashscope': 'qwen-turbo',
    'deepseek': 'deepseek-chat',
    'kimi': 'moonshot-v1-8k',
};
document.getElementById('translate-provider').addEventListener('change', (e) => {
    const defaultModel = PROVIDER_DEFAULTS[e.target.value];
    if (defaultModel) {
        document.getElementById('translate-model').value = defaultModel;
    }
});

// Test ASR connection button
document.getElementById('test-asr-btn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('asr-test-status');
    statusDiv.textContent = '测试中...';
    statusDiv.className = 'status-message';
    
    try {
        // Build config from current input values
        const config = {
            asr: {
                provider: document.getElementById('asr-provider').value,
                file_model: document.getElementById('asr-file-model').value,
                realtime_model: document.getElementById('asr-realtime-model').value,
                api_key: document.getElementById('asr-api-key').value,
                workspace_id: document.getElementById('asr-workspace-id').value.trim() || null,
            },
            translate: {
                provider: document.getElementById('translate-provider').value,
                model: document.getElementById('translate-model').value,
                api_key: document.getElementById('translate-api-key').value,
                target_lang: document.getElementById('translate-target-lang').value,
            },
            oss: (() => {
                const endpoint = document.getElementById('oss-endpoint').value.trim();
                const bucket = document.getElementById('oss-bucket').value.trim();
                const accessKeyId = document.getElementById('oss-access-key-id').value.trim();
                const accessKeySecret = document.getElementById('oss-access-key-secret').value.trim();
                const pathPrefix = document.getElementById('oss-path-prefix').value.trim();
                
                if (!endpoint && !bucket && !accessKeyId && !accessKeySecret) {
                    return null;
                }
                
                return {
                    endpoint,
                    bucket,
                    access_key_id: accessKeyId,
                    access_key_secret: accessKeySecret,
                    path_prefix: pathPrefix || null,
                };
            })(),
        };
        
        const result = await invoke('test_asr_connection', { config });
        statusDiv.textContent = result;
        statusDiv.className = 'status-message success';
    } catch (error) {
        statusDiv.textContent = error;
        statusDiv.className = 'status-message error';
    }
});

// Test translate connection button
document.getElementById('test-translate-btn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('translate-test-status');
    statusDiv.textContent = '测试中...';
    statusDiv.className = 'status-message';
    
    try {
        // Build config from current input values
        const config = {
            asr: {
                provider: document.getElementById('asr-provider').value,
                file_model: document.getElementById('asr-file-model').value,
                realtime_model: document.getElementById('asr-realtime-model').value,
                api_key: document.getElementById('asr-api-key').value,
                workspace_id: document.getElementById('asr-workspace-id').value.trim() || null,
            },
            translate: {
                provider: document.getElementById('translate-provider').value,
                model: document.getElementById('translate-model').value,
                api_key: document.getElementById('translate-api-key').value,
                target_lang: document.getElementById('translate-target-lang').value,
            },
            oss: null, // Not needed for translate test
        };
        
        const result = await invoke('test_translate_connection', { config });
        statusDiv.textContent = result;
        statusDiv.className = 'status-message success';
    } catch (error) {
        statusDiv.textContent = error;
        statusDiv.className = 'status-message error';
    }
});

// Export buttons
document.getElementById('export-srt-btn').addEventListener('click', async () => {
    await exportSubtitle('srt');
});

document.getElementById('export-vtt-btn').addEventListener('click', async () => {
    await exportSubtitle('vtt');
});

async function exportSubtitle(format) {
    const statusDiv = document.getElementById('export-status');
    statusDiv.textContent = '导出中...';
    statusDiv.className = 'status-message';
    
    try {
        const path = await invoke('export_subtitle', { format });
        statusDiv.textContent = `导出成功: ${path}`;
        statusDiv.className = 'status-message success';
    } catch (error) {
        statusDiv.textContent = '导出失败: ' + error;
        statusDiv.className = 'status-message error';
    }
}

// Show export section when processing is complete
function showExportSection() {
    document.getElementById('export-section').style.display = 'block';
}
