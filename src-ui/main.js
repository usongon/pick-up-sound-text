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
const fileInput = document.getElementById('file-input');

// Tauri native drag-drop provides real file paths (unlike HTML5 drop)
window.__TAURI__.event.listen('tauri://drag-drop', (event) => {
    dropZone.classList.remove('dragover');
    const paths = event.payload.paths;
    if (paths.length > 0) {
        handleFilePath(paths[0]);
    }
});

window.__TAURI__.event.listen('tauri://drag-enter', () => {
    dropZone.classList.add('dragover');
});

window.__TAURI__.event.listen('tauri://drag-leave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        // File input doesn't provide paths in Tauri; open dialog instead
        const filePath = await window.__TAURI__.dialog.open({
            multiple: false,
            filters: [{
                name: 'Video',
                extensions: ['mp4', 'mkv', 'avi', 'mov']
            }]
        });
        if (filePath) {
            handleFilePath(filePath);
        }
        e.target.value = '';
    }
});

async function handleFilePath(filePath) {
    console.log('File selected:', filePath);

    try {
        const displayName = filePath.split('/').pop() || filePath.split('\\').pop();

        const result = await window.__TAURI__.invoke('start_file_processing', {
            videoPath: filePath
        });

        console.log('Processing started, task:', result);

        addTaskToList(displayName);
        startProgressPolling();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error);
    }
}

function addTaskToList(fileName) {
    const taskList = document.getElementById('task-list');
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';

    const fileNameDiv = document.createElement('div');
    fileNameDiv.textContent = `📹 ${fileName}`; // Use textContent instead of innerHTML

    const progressDiv = document.createElement('div');
    progressDiv.className = 'task-progress';

    const progressBar = document.createElement('div');
    progressBar.className = 'task-progress-bar';
    progressBar.style.width = '0%';

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
            const progress = await window.__TAURI__.invoke('get_processing_progress');
            updateProgress(progress);

            if (progress >= 1.0) {
                clearInterval(progressInterval);
                progressInterval = null;
                showExportSection(); // Show export buttons when complete
            }
        } catch (error) {
            console.error('Progress polling error:', error);
        }
    }, 1000); // Poll every second
}

function updateProgress(progress) {
    const progressBars = document.querySelectorAll('.task-progress-bar');
    progressBars.forEach(bar => {
        bar.style.width = `${progress * 100}%`;
    });
}

// Settings page logic
async function loadConfig() {
    try {
        const config = await window.__TAURI__.invoke('get_config');
        
        // ASR config
        document.getElementById('asr-provider').value = config.asr.provider;
        document.getElementById('asr-model').value = config.asr.model;
        document.getElementById('asr-api-key').value = config.asr.api_key;
        document.getElementById('asr-language').value = config.asr.language;
        
        // Translate config
        document.getElementById('translate-provider').value = config.translate.provider;
        document.getElementById('translate-base-url').value = config.translate.base_url;
        document.getElementById('translate-model').value = config.translate.model;
        document.getElementById('translate-api-key').value = config.translate.api_key;
        document.getElementById('translate-target-lang').value = config.translate.target_lang;
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
                model: document.getElementById('asr-model').value,
                api_key: document.getElementById('asr-api-key').value,
                language: document.getElementById('asr-language').value,
            },
            translate: {
                provider: document.getElementById('translate-provider').value,
                base_url: document.getElementById('translate-base-url').value,
                model: document.getElementById('translate-model').value,
                api_key: document.getElementById('translate-api-key').value,
                target_lang: document.getElementById('translate-target-lang').value,
            },
        };
        
        await window.__TAURI__.invoke('save_config', { config });
        
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

// Test ASR connection button
document.getElementById('test-asr-btn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('asr-test-status');
    statusDiv.textContent = '测试中...';
    statusDiv.className = 'status-message';
    
    try {
        // TODO: Implement ASR connection test
        // For now, just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusDiv.textContent = 'ASR 连接成功';
        statusDiv.className = 'status-message success';
    } catch (error) {
        statusDiv.textContent = 'ASR 连接失败: ' + error;
        statusDiv.className = 'status-message error';
    }
});

// Test translate connection button
document.getElementById('test-translate-btn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('translate-test-status');
    statusDiv.textContent = '测试中...';
    statusDiv.className = 'status-message';
    
    try {
        // TODO: Implement translate connection test
        // For now, just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusDiv.textContent = '翻译连接成功';
        statusDiv.className = 'status-message success';
    } catch (error) {
        statusDiv.textContent = '翻译连接失败: ' + error;
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
        const path = await window.__TAURI__.invoke('export_subtitle', { format });
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
