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

    // 添加请求到队列
    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    // 处理队列中的请求
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

    // 补充令牌
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

// 创建请求队列实例
const requestQueue = new RequestQueue(30);
let currentInfoWindow = null;

// 在页面加载完成后初始化地图
document.addEventListener('DOMContentLoaded', () => {
    // 先获取百度地图API密钥，然后初始化地图
    fetch('/api/map-key')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                window.BMAP_AUTHENTIC_KEY = result.apiKey;
                initMap();
                initEventListeners();
                // 加载已存储的地址数据
                loadStoredAddresses();
            } else {
                console.error('获取地图API密钥失败');
            }
        })
        .catch(error => {
            console.error('获取地图API密钥失败:', error);
        });
});

// 初始化百度地图
function initMap() {
    map = new BMap.Map('map');
    const point = new BMap.Point(120.153576, 30.287459); // 杭州市中心坐标
    map.centerAndZoom(point, 12);
    map.enableScrollWheelZoom();
    map.addControl(new BMap.NavigationControl());
    map.addControl(new BMap.ScaleControl());
}

// 初始化事件监听器
function initEventListeners() {
    const uploadBtn = document.getElementById('upload-btn');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const addressList = document.getElementById('address-list');

    // 添加地址列表区域的点击事件
    addressList.addEventListener('click', (event) => {
        // 检查点击的元素是否为地址列表容器本身
        if (event.target === addressList) {
            // 清除所有地址项的选中状态
            document.querySelectorAll('.address-item').forEach(item => {
                item.classList.remove('active');
            });
            // 重置所有标记点的状态
            markers.forEach(marker => {
                marker.setSelected(false);
            });
            // 关闭当前信息窗口
            if (currentInfoWindow) {
                currentInfoWindow.close();
                currentInfoWindow = null;
            }
            // 重置地图视图到初始状态
            const defaultPoint = new BMap.Point(120.153576, 30.287459); // 杭州市中心坐标
            map.centerAndZoom(defaultPoint, 12);
        }
    });

    uploadBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('excel-file');
        const file = fileInput.files[0];

        if (!file) {
            uploadStatus.textContent = '请选择Excel文件';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        uploadStatus.textContent = '正在上传并解析文件...';

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                uploadStatus.textContent = '文件解析成功';
                displayAddresses(result.data);
                markAddressesOnMap(result.data);
            } else {
                uploadStatus.textContent = '文件解析失败：' + result.error;
            }
        })
        .catch(error => {
            uploadStatus.textContent = '上传失败：' + error.message;
        });
    });
}

// 在地址列表中显示地址
function displayAddresses(addresses) {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '';

    addresses.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'address-item';
        
        // 创建名称元素
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = item.name || '未命名';
        
        // 创建地址元素
        const addressDiv = document.createElement('div');
        addressDiv.className = 'address';
        addressDiv.textContent = item.address;
        
        // 添加名称和地址到地址项
        div.appendChild(nameDiv);
        div.appendChild(addressDiv);
        
        div.addEventListener('click', () => {
            // 移除其他地址的active类
            document.querySelectorAll('.address-item').forEach(item => {
                item.classList.remove('active');
            });
            // 添加active类到当前点击的地址
            div.classList.add('active');
            // 如果存在对应的标记
            if (markers[index]) {
                // 获取标记的位置
                const point = markers[index].getPosition();
                // 将地图居中到该位置
                map.centerAndZoom(point, map.getZoom());
                // 重置所有标记点的状态
                markers.forEach((marker, i) => {
                    marker.setSelected(i === index);
                });
                // 关闭当前信息窗口
                if (currentInfoWindow) {
                    currentInfoWindow.close();
                }
                // 打开对应标记点的信息窗口
                const infoWindow = markers[index].infoWindow;
                if (infoWindow) {
                    map.openInfoWindow(infoWindow, point);
                    currentInfoWindow = infoWindow;
                }
            }
        });
        addressList.appendChild(div);
    });
}

// 加载已存储的地址数据
function loadStoredAddresses() {
    fetch('/addresses')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                displayAddresses(result.data);
                markAddressesOnMap(result.data);
            } else {
                console.error('加载地址数据失败：', result.error);
            }
        })
        .catch(error => {
            console.error('加载地址数据失败：', error);
        });
}

// 在地图上标注地址
function markAddressesOnMap(addresses) {
    if (!map) {
        console.error('地图实例未初始化');
        return;
    }
    console.log('开始标注地址，总数：', addresses.length);
    console.log('当前地图中心点：', map.getCenter());
    console.log('当前地图缩放级别：', map.getZoom());

    // 清除现有标注
    markers.forEach(marker => {
        map.removeOverlay(marker);
    });
    markers = [];

    // 创建地址解析服务
    const geocoder = new BMap.Geocoder();
    let processedAddresses = 0;
    
    // 创建标注点并添加到地图
    addresses.forEach((item, index) => {
        console.log(`开始解析第${index + 1}个地址：${item.address}`);
        try {
            // 将地理编码请求添加到队列中
            requestQueue.enqueue(() => new Promise((resolve) => {
                geocoder.getPoint(item.address, (point) => {
                    resolve(point);
                }, '中国');
            })).then((point) => {
                processedAddresses++;
                console.log(`地址解析结果：${item.address}`, point);
                
                if (point) {
                    try {
                        // 创建文字标签
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
                        
                        // 创建自定义图标
                        const normalIcon = new BMap.Icon("https://api.map.baidu.com/images/marker_red.png", new BMap.Size(23, 25));
                        const selectedIcon = new BMap.Icon("https://api.map.baidu.com/images/marker_red.png", new BMap.Size(35, 38));
                        
                        const marker = new BMap.Marker(point, { icon: normalIcon });
                        marker.setLabel(label);
                        map.addOverlay(marker);
                        markers.push(marker);
                        
                        // 添加选中状态切换方法
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
                        console.log(`成功添加标记点：${item.address}`, point);

                        // 创建信息窗口
                        const infoWindow = new BMap.InfoWindow(
                            `<div class="info-window">
                                <h4>${item.name || '未命名'}</h4>
                                <p class="info-address">${item.address}</p>
                                ${Object.entries(item)
                                    .filter(([key]) => !['address', 'name'].includes(key))
                                    .map(([key, value]) => `<p class="info-item"><span class="info-label">${key}:</span> ${value}</p>`)
                                    .join('')}
                            </div>`,
                            {
                                enableAutoPan: true,
                                enableCloseOnClick: true
                            }
                        );

                        // 将信息窗口保存到标记点对象中
                        marker.infoWindow = infoWindow;

                        // 添加点击事件
                        marker.addEventListener('click', () => {
                            if (currentInfoWindow) {
                                currentInfoWindow.close();
                            }
                            map.openInfoWindow(infoWindow, point);
                            currentInfoWindow = infoWindow;

                            // 高亮对应的地址列表项并更新标记点样式
                            document.querySelectorAll('.address-item').forEach((item, i) => {
                                item.classList.toggle('active', i === index);
                                markers[i]?.setSelected(i === index);
                            });

                            // 确保地址列表项可见
                            const addressItem = document.querySelectorAll('.address-item')[index];
                            if (addressItem) {
                                addressItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                        });
                    } catch (err) {
                        console.error(`添加标记点失败：${item.address}`, err);
                    }
                } else {
                    console.error(`地址解析失败: ${item.address}`);
                }

                // 如果是最后一个地址，调整地图视野
                if (processedAddresses === addresses.length) {
                    console.log('所有地址处理完成，调整地图视野');
                    const points = markers.map(m => m.getPosition()).filter(Boolean);
                    if (points.length > 0) {
                        map.setViewport(points);
                        console.log('地图视野已调整到包含所有标记点');
                    } else {
                        console.warn('没有有效的标记点可以调整视野');
                    }
                }
            }, '中国');
        } catch (err) {
            console.error(`地址解析过程出错：${item.address}`, err);
        }
    });
}