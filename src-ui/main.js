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

dropZone.addEventListener('click', () => {
    fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
        e.target.value = ''; // Clear value to allow re-selecting same file
    }
});

async function handleFile(file) {
    console.log('File selected:', file.name);

    try {
        let filePath;
        
        // If file has a path property (from Tauri drag-drop), use it directly
        if (file.path) {
            filePath = file.path;
        } else {
            // Otherwise, use Tauri Dialog API to get file path
            filePath = await window.__TAURI__.dialog.open({
                multiple: false,
                filters: [{
                    name: 'Video',
                    extensions: ['mp4', 'mkv', 'avi', 'mov']
                }]
            });
        }

        if (!filePath) {
            return; // User cancelled
        }

        // Extract display name from path
        const displayName = filePath.split('/').pop() || filePath.split('\\').pop() || file.name;

        // Call Tauri command to start processing
        const result = await window.__TAURI__.invoke('start_file_processing', {
            videoPath: filePath
        });

        console.log('Processing started:', result);

        // Add task to list with correct display name
        addTaskToList(displayName);

        // Start polling progress
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
