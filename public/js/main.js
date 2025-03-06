// 初始化地图
let map = null;
let markers = [];

// 请求队列管理器
class RequestQueue {
    constructor(qps = 30) {
        this.qps = qps;
        this.queue = [];
        this.tokens = qps;
        this.lastRefillTime = Date.now();
        this.processing = false;
    }

    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            this.refillTokens();
            if (this.tokens > 0) {
                const { task, resolve, reject } = this.queue.shift();
                this.tokens--;
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.processing = false;
    }

    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefillTime;
        const tokensToAdd = Math.floor(timePassed * (this.qps / 1000));

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.qps, this.tokens + tokensToAdd);
            this.lastRefillTime = now;
        }
    }
}

const requestQueue = new RequestQueue(30);
let currentInfoWindow = null;

let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    loadStoredAddresses();
    
    // 初始化折叠面板
    const collapseHeader = document.querySelector('.ant-collapse-item .ant-collapse-header');
    const collapseContent = document.querySelector('.ant-collapse-item .ant-collapse-content');
    const collapseArrow = collapseHeader ? collapseHeader.querySelector('.ant-collapse-arrow') : null;
    
    if (collapseHeader && collapseContent && collapseArrow) {
        // 设置初始状态
        collapseContent.style.transition = 'height 0.3s ease-in-out';
        collapseContent.style.overflow = 'hidden';
        collapseContent.style.height = '0';
        
        // 确保初始状态下有正确的类名
        if (!collapseContent.classList.contains('ant-collapse-content-inactive')) {
            collapseContent.classList.add('ant-collapse-content-inactive');
        }
        
        collapseHeader.addEventListener('click', function(event) {
            // 阻止事件冒泡
            event.preventDefault();
            event.stopPropagation();
            
            const isActive = collapseContent.classList.contains('ant-collapse-content-active');
            
            if (isActive) {
                // 折叠面板
                collapseContent.style.height = '0';
                setTimeout(() => {
                    collapseContent.classList.remove('ant-collapse-content-active');
                    collapseContent.classList.add('ant-collapse-content-inactive');
                }, 10);
                collapseArrow.style.transform = 'rotate(0deg)';
            } else {
                // 展开面板
                collapseContent.classList.remove('ant-collapse-content-inactive');
                collapseContent.classList.add('ant-collapse-content-active');
                collapseContent.style.height = collapseContent.scrollHeight + 'px';
                collapseArrow.style.transform = 'rotate(90deg)';
            }
        });
    } else {
        console.error('折叠面板初始化失败：未找到必要的DOM元素');
    }
    
    // 初始化分页事件
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageInput = document.getElementById('current-page');
    
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateAddressList();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
            currentPage++;
            updateAddressList();
        }
    });
    
    currentPageInput.addEventListener('change', () => {
        const value = parseInt(currentPageInput.value);
        if (!isNaN(value) && value >= 1 && value <= Math.ceil(totalItems / itemsPerPage)) {
            currentPage = value;
            updateAddressList();
        } else {
            currentPageInput.value = currentPage;
        }
    });
});

function initMap() {
    try {
        map = new BMap.Map('map-container');
        const point = new BMap.Point(120.153576, 30.287459);
        map.centerAndZoom(point, 12);
        map.enableScrollWheelZoom();
        map.addControl(new BMap.NavigationControl());
        map.addControl(new BMap.ScaleControl());
        console.log('地图初始化成功');
    } catch (error) {
        console.error('地图初始化失败:', error);
    }
}

function initEventListeners() {
    const uploadBtn = document.getElementById('upload-btn');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const addressList = document.getElementById('address-list');

    addressList.addEventListener('click', (event) => {
        if (event.target === addressList) {
            document.querySelectorAll('.address-item').forEach(item => {
                item.classList.remove('active');
            });
            markers.forEach(marker => {
                marker.setSelected(false);
            });
            if (currentInfoWindow) {
                currentInfoWindow.close();
                currentInfoWindow = null;
            }
            const defaultPoint = new BMap.Point(120.153576, 30.287459);
            map.centerAndZoom(defaultPoint, 12);
        }
    });

    uploadBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('excel-file');
        fileInput.click(); // 触发文件选择窗口
    });

    // 监听文件选择变化
    const fileInput = document.getElementById('excel-file');
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];

        if (!file) {
            showUploadStatus('请选择Excel文件', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        showUploadStatus('正在上传并解析文件...', 'info');

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showUploadStatus('文件解析成功', 'success');
                displayAddresses(result.data);
                markAddressesOnMap(result.data);
            } else {
                showUploadStatus('文件解析失败：' + result.error, 'error');
            }
        })
        .catch(error => {
            showUploadStatus('上传失败：' + error.message, 'error');
        });
    });
}

function showUploadStatus(message, type) {
    const uploadStatus = document.getElementById('upload-status');
    uploadStatus.className = `ant-alert ant-alert-${type}`;
    uploadStatus.style.display = 'block';
    uploadStatus.textContent = message;
}

function displayAddresses(addresses) {
    const addressList = document.getElementById('address-list');
    const paginationContainer = document.querySelector('.ant-pagination');

    // 检查数据是否为空
    if (!addresses || addresses.length === 0) {
        addressList.innerHTML = '<div class="ant-alert ant-alert-info">暂无数据</div>';
        paginationContainer.style.display = 'none';
        return;
    }

    totalItems = addresses.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    document.getElementById('total-pages').textContent = totalPages;
    
    // 更新分页组件的显示状态
    paginationContainer.style.display = totalItems <= itemsPerPage ? 'none' : 'flex';
    
    // 更新分页按钮状态
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageInput = document.getElementById('current-page');
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    currentPageInput.value = currentPage;
    
    addressList.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalItems);
    const pageAddresses = addresses.slice(start, end);
    
    pageAddresses.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'address-item';
        div.style.cssText = 'padding: 8px 12px; margin-bottom: 4px; background: #fff; cursor: pointer; transition: all 0.3s; border-radius: 4px;';
        
        const title = document.createElement('div');
        title.className = 'address-item-title';
        title.style.cssText = 'font-size: 14px; font-weight: 500; color: #333; margin-bottom: 4px;';
        title.textContent = item.name || '未命名';
        
        const description = document.createElement('div');
        description.className = 'address-item-description';
        description.style.cssText = 'font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        description.textContent = item.address;
        
        div.appendChild(title);
        div.appendChild(description);
        
        div.addEventListener('mouseover', () => {
            div.style.backgroundColor = '#f5f5f5';
        });
        
        div.addEventListener('mouseout', () => {
            if (!div.classList.contains('active')) {
                div.style.backgroundColor = '#fff';
            }
        });
        
        div.addEventListener('click', () => {
            document.querySelectorAll('.address-item').forEach(item => {
                item.classList.remove('active');
                item.style.backgroundColor = '#fff';
            });
            div.classList.add('active');
            div.style.backgroundColor = '#e6f7ff';
            
            const globalIndex = start + index;
            if (markers[globalIndex]) {
                const point = markers[globalIndex].getPosition();
                map.centerAndZoom(point, map.getZoom());
                markers.forEach((marker, i) => {
                    marker.setSelected(i === globalIndex);
                });
                if (currentInfoWindow) {
                    currentInfoWindow.close();
                }
                const infoWindow = markers[globalIndex].infoWindow;
                if (infoWindow) {
                    map.openInfoWindow(infoWindow, point);
                    currentInfoWindow = infoWindow;
                }
            }
        });
        addressList.appendChild(div);
    });
}

function updateAddressList() {
    fetch('/addresses')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                displayAddresses(result.data);
            }
        })
        .catch(error => console.error('更新地址列表失败：', error));
}

function loadStoredAddresses(retryCount = 0, maxRetries = 3) {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '<div class="ant-spin ant-spin-spinning"><span class="ant-spin-dot"></span><div class="ant-spin-text">正在加载数据...</div></div>';

    fetch('/addresses')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                displayAddresses(result.data);
                markAddressesOnMap(result.data);
                addressList.querySelector('.ant-spin')?.remove();
            } else {
                console.error('加载地址数据失败：', result.error);
                if (retryCount < maxRetries) {
                    addressList.innerHTML = `<div class="ant-alert ant-alert-info">加载失败，正在重试 (${retryCount + 1}/${maxRetries})...</div>`;
                    setTimeout(() => loadStoredAddresses(retryCount + 1, maxRetries), 2000);
                } else {
                    addressList.innerHTML = '<div class="ant-alert ant-alert-error">数据加载失败，请刷新页面重试</div>';
                }
            }
        })
        .catch(error => {
            console.error('加载地址数据失败：', error);
            if (retryCount < maxRetries) {
                addressList.innerHTML = `<div class="ant-alert ant-alert-info">加载失败，正在重试 (${retryCount + 1}/${maxRetries})...</div>`;
                setTimeout(() => loadStoredAddresses(retryCount + 1, maxRetries), 2000);
            } else {
                addressList.innerHTML = '<div class="ant-alert ant-alert-error">数据加载失败，请刷新页面重试</div>';
            }
        });
}

function markAddressesOnMap(addresses) {
    if (!map) {
        console.error('地图实例未初始化');
        return;
    }

    markers.forEach(marker => {
        map.removeOverlay(marker);
    });
    markers = [];

    const geocoder = new BMap.Geocoder();
    let processedAddresses = 0;
    
    addresses.forEach((item, index) => {
        requestQueue.enqueue(() => new Promise((resolve) => {
            geocoder.getPoint(item.address, (point) => {
                resolve(point);
            }, '中国');
        })).then((point) => {
            processedAddresses++;
            
            if (point) {
                try {
                    const label = new BMap.Label(item.name || '未命名', {
                        offset: new BMap.Size(20, -10),
                        style: {
                            color: '#666666',
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '2px',
                            backgroundColor: 'white',
                            border: '1px solid #ddd'
                        }
                    });
                    
                    const normalIcon = new BMap.Icon("https://api.map.baidu.com/images/marker_red.png", new BMap.Size(23, 25));
                    const selectedIcon = new BMap.Icon("https://api.map.baidu.com/images/marker_red.png", new BMap.Size(35, 38));
                    
                    const marker = new BMap.Marker(point, { icon: normalIcon });
                    marker.setLabel(label);
                    map.addOverlay(marker);
                    markers.push(marker);
                    
                    marker.setSelected = function(selected) {
                        this.setIcon(selected ? selectedIcon : normalIcon);
                        if (selected) {
                            this.setTop(true);
                            this.getLabel().setStyle({ fontSize: '14px', padding: '3px 10px' });
                        } else {
                            this.setTop(false);
                            this.getLabel().setStyle({ fontSize: '12px', padding: '2px 8px' });
                        }
                    };

                    const infoWindowContent = `
                        <div class="ant-card" style="width: 300px; border: none;">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">${item.name || '未命名'}</div>
                            </div>
                            <div class="ant-card-body">
                                <p><strong>地址：</strong>${item.address}</p>
                                ${Object.entries(item)
                                    .filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v', 'address', 'name'].includes(key))
                                    .map(([key, value]) => `<p><strong>${key}：</strong>${value}</p>`)
                                    .join('')}
                            </div>
                        </div>`;

                    const infoWindow = new BMap.InfoWindow(infoWindowContent, {
                        width: 320,
                        height: 200,
                        enableAutoPan: true,
                        enableCloseOnClick: true
                    });

                    marker.infoWindow = infoWindow;

                    marker.addEventListener('click', () => {
                        if (currentInfoWindow) {
                            currentInfoWindow.close();
                        }
                        map.openInfoWindow(infoWindow, point);
                        currentInfoWindow = infoWindow;

                        document.querySelectorAll('.address-item').forEach((item, i) => {
                            item.classList.toggle('active', i === index);
                            markers[i]?.setSelected(i === index);
                        });

                        const addressItem = document.querySelectorAll('.address-item')[index];
                        if (addressItem) {
                            addressItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    });
                } catch (err) {
                    console.error(`添加标记点失败：${item.address}`, err);
                }
            }

            if (processedAddresses === addresses.length) {
                const points = markers.map(m => m.getPosition()).filter(Boolean);
                if (points.length > 0) {
                    map.setViewport(points);
                }
            }
        });
    });
}