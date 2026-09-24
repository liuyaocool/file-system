const apiPath = "/fs-api"
    // path: /test/xxx.png
    ,openUrl = path => `/fs-open${path.replaceAll("&", "%26")}`
    ,downUrl = path => `/fs-down${path.replaceAll("&", "%26")}`
    ,listUrl = path => `${apiPath}/list_file/${urlSafeBase64(path)}`
    ,FS_TYPE = {
        FOLDER: 'folder',
        IMAGE: 'image',
        VIDEO: 'video',
        TEXT: 'text',
        PDF: 'pdf',
        ZIP: 'zip',
        DOC: 'doc',
        EXCEL: 'excel',
        PPT: 'ppt',
        NOT_SUPPORT: 'not_support'
    }
    ,FS_TYPE_SUFFIX = {}
;

FS_TYPE_SUFFIX[FS_TYPE.IMAGE] = ['.webp', '.png', '.jpeg', '.jpg', '.svg', '.gif'];
FS_TYPE_SUFFIX[FS_TYPE.VIDEO] = ['.mkv', '.m4v', '.webm', '.mp4'];
FS_TYPE_SUFFIX[FS_TYPE.TEXT ] = [
    '.txt', '.md', '.properties', '.conf', '.xml', '.desktop', '.log', '.ini'
];
FS_TYPE_SUFFIX[FS_TYPE.PDF  ] = ['.pdf'];
FS_TYPE_SUFFIX[FS_TYPE.ZIP  ] = ['.zip', '.rar'];
FS_TYPE_SUFFIX[FS_TYPE.DOC  ] = ['.doc', '.docx'];
FS_TYPE_SUFFIX[FS_TYPE.EXCEL] = ['.xls', '.xlsx'];
FS_TYPE_SUFFIX[FS_TYPE.PPT  ] = ['.ppt'];

function openFile(isNewPage, openPage, filePath, sendData) {
    setSendData(sendData);
    let openPageUrl = `${openPage}?${encodeURIComponent(filePath)}`;
    if (isNewPage) {
        window.open(openPageUrl);
    } else {
        location.href = openPageUrl;
    }
}

function setSendData(sendData) {
    if (sendData) {
        localStorage.setItem('sendData', JSON.stringify(sendData));
    }

}
function getSendData() {
    let sendData = localStorage.getItem('sendData');
    return sendData ? JSON.parse(sendData) : null;
}

/**
 * return [FS_TYPE, suffixStr]
 */
function fsMimeType(nameOrPath, isDir = false) {
    if(isDir) return [FS_TYPE.FOLDER, '-'];
    nameOrPath = nameOrPath.toLowerCase();
    for(const k in FS_TYPE_SUFFIX) {
        for (var i = 0; i < FS_TYPE_SUFFIX[k].length; i++) {
            if(nameOrPath.endsWith(FS_TYPE_SUFFIX[k][i])) {
                return [k, FS_TYPE_SUFFIX[k][i]];
            }
        }
    }
    return [FS_TYPE.NOT_SUPPORT, '-'];
}

function isMobile() {
    return /Mobi/.test(navigator.userAgent);
}

function isTouch() {
  return navigator.maxTouchPoints > 0;
}

function includeCss(pcLink, h5Link) {
    let dom = document.createElement('link');
    dom.rel = 'stylesheet';
    dom.href = isMobile() ? h5Link : pcLink;
    document.head.appendChild(dom);
};

function fileChooser(accept = null, multiple = false) {
    return new Promise((resolve, reject) => {
        let fileInput = document.createElement('input');
        if (multiple === true) {
            fileInput.multiple = true;
        }
        fileInput.type = 'file';
        if (accept) {
            fileInput.accept = accept;
        }
        fileInput.onchange = function (ev) {
            resolve(multiple === true ? ev.target.files : ev.target.files[0]);
        }
        fileInput.click();
    })
}
function uuid(len) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let radix = chars.length, uuid = '', i;
    len = len > 0 ? len : 32;
    for (i = 0; i < len; i++) uuid += chars.charAt(0 | Math.random() * radix);
    return uuid;
}

/**
 * send http
 * @param option
 * @demo: fileUpload(url, formData, {
 *      method: 'post',
 *      headers: {
 *          "Content-Type", 'application/json'
 *      },
 *      async: true,
 *      progress: function(ev) { // 上传进度
 *      },
 *  }).then(function(res) {
 *  
 *  }).catch(function(res) {
 *  })
 */
function fileUpload(url, formData, option = {}) {
    return new Promise((resolve, reject) => {
        let http = new XMLHttpRequest();
        http.open(
            option.method || "post", 
            url,
            false === option.async ? false : true
        );
        if (option.headers && (typeof option.headers == "object")) {
            for (let headerName in option.headers) {
                http.setRequestHeader(headerName, option.headers[headerName]);
            }
        }
        if (isFunc(option.progress) && http.upload) {
            http.upload.addEventListener('progress' , option.progress, false);
        }
        http.send(formData);
        http.onreadystatechange = function (res) {
            if (4 != res.target.readyState) {
                return;
            }
            if (200 == res.target.status) {
                resolve(res.target.response);
            } else {
                reject(res.target.response);
            }
        }
    });
}
function isFunc(f) {
    return f && typeof f === 'function';
}

function urlSafeBase64(str = '') {
    // console.log(str);
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

function dateFormat(sec) {
    DATE_TEMP.setTime(sec * 1000);
    const year = DATE_TEMP.getFullYear();
    const month = String(DATE_TEMP.getMonth() + 1).padStart(2, '0');
    const day = String(DATE_TEMP.getDate()).padStart(2, '0');
    const hours = String(DATE_TEMP.getHours()).padStart(2, '0');
    const minutes = String(DATE_TEMP.getMinutes()).padStart(2, '0');
    const seconds = String(DATE_TEMP.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}