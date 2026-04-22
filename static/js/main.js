
const PART_SIZE = 5*1024*1024;
const FS_TYPE = {
    FOLDER: 'folder',
    IMAGE: 'image',
    VIDEO: 'video',
    TEXT: 'text',
    PDF: 'pdf',
    ZIP: 'zip',
    DOC: 'doc',
    EXCEL: 'excel',
    PPT: 'ppt',
};
const FS_OPEN = {};
const DATE_TEMP = new Date();
FS_OPEN[FS_TYPE.IMAGE] = 'open/img.html';
FS_OPEN[FS_TYPE.TEXT] = 'open/text.html';
FS_OPEN[FS_TYPE.VIDEO] = 'open/video.html';

const vm = Vue.createApp({
    data() {
        // let p = location.hash ? location.hash.slice(1) : localStorage.getItem('path');
        let p = location.hash ? decodeURIComponent(location.hash.slice(1, -1)).trim() : "";
        let pagePath = ['/'];
        if(p) {
            pagePath = p.split('/');
            for (let i = 0; i < pagePath.length; i++) {
                pagePath[i] += '/';
            }
        }
        return {
            sortColumn: '',
            sortIsAsc: true,
            isMobile: isMobile(),
            picMode: 'true' === localStorage.getItem('picMode'),
            msg: '',
            msgList: [],
            showHidden: 'true' === localStorage.getItem('showHidden'),
            pagePath: pagePath, // every ends with '/'
            /**
            { name, nameLen, size, sizeStr, time, timeStr, path, 
                "suffix": "", // zip, tar.gz, tar.zst
                "fsType": "", // FS_TYPE
            } */
            allFiles: [],
            normalFiles: [],
                
        }
    },
    computed: {
        files() {
            // 根据条件返回对应的数据源
            return this.showHidden ? this.allFiles : this.normalFiles;
        },
    },
    created() {
        this.getFiles();
    },
    methods: {
        async getFiles() {
            let pp = location.hash = this.getPagePath();
            pp = pp && !pp.endsWith('/') ? (pp + '/') : (pp || '/');
            localStorage.setItem('path', pp);
            let res = await (await fetch(`${apiPath}/list_file/${urlSafeBase64(pp)}`)).json();
            for (let i = 0; i < res.length; i++) {
                res[i].sizeStr = res[i].dir ? '-' : calcFileLength(res[i].size);
                res[i].timeStr = dateFormat(res[i].time);
                res[i].suffix = res[i].dir ? '-' : getFileSuffix(res[i].name);
                res[i].fsType = res[i].dir ? FS_TYPE.FOLDER : fsMimeType(res[i].suffix);
                res[i].path = `${this.getPagePath()}${res[i].name}`;
                res[i].preview = this.getFilePreview(res[i].fsType, res[i].path);
                res[i].nameLen = calcNameLen(res[i].name);
            }
            this.allFiles = res;
            this.normalFiles = res.filter(f => f.name[0] != '.');
            this.reSort('name', 'asc');
            // 回到页头
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        },
        sortClick(sortColumn = 'name') {
            this.reSort(sortColumn, this.sortColumn != sortColumn || !this.sortIsAsc);
        },
        reSort(column, isAsc) {
            this.sortColumn = column;
            this.sortIsAsc = isAsc;
            [this.normalFiles, this.allFiles].forEach(files => files.sort((f1, f2) => {
                if (f1.fsType != f2.fsType) {
                    if (f1.dir) return -1;
                    if (f2.dir) return 1;
                }
                let sorted = this.compareColumn(f1, f2, this.sortColumn);
                return isAsc || f1.dir ? sorted : -sorted;
            }));
        },
        compareColumn(f1, f2, column) {
            switch (column) {
                case 'name':
                    let f1Name = f1.name.toLowerCase(),
                        f2Name = f2.name.toLowerCase(),
                        min = Math.min(f1Name.length, f2Name.length);
                    for (let i = 0; i < min; i++)
                        if (f1Name[i] != f2Name[i])
                            return f1Name.charCodeAt(i) - f2Name.charCodeAt(i);
                    return f1Name.length - f2Name.length;
                case 'size':
                    return f1.dir ? -1 : (f1.size - f2.size);
                case 'time':
                    return f1.time == f2.time ? -1 : f1.time - f2.time;
            }
        },
        getSortIcon(column) {
            return this.sortColumn == column ? (this.sortIsAsc ? 'icon-sort-up' : 'icon-sort-down') : '';
        },
        toggleShowHidden() {
            this.showHidden = !this.showHidden;
            localStorage.setItem('showHidden', this.showHidden);
        },
        togglePicMode() {
            this.picMode = !this.picMode;
            localStorage.setItem('picMode', this.picMode);
        },
        folderEnter(folderName) {
            // 第一层路径
            this.pagePath.push(folderName + "/");
            this.getFiles();
        },
        folderLeave() {
            if (this.pagePath.length <= 1) {
                return;
            }
            this.pagePath.pop();
            this.getFiles();
        },
        gotoPagePath(idx) {
            idx = Math.max(0, idx);
            while (this.pagePath.length > (idx+1)) {
                this.pagePath.pop();
            }
            this.getFiles();
        },
        getPagePath() {
            return this.pagePath.join('').replace("//", "/");
        },
        clickName(row) {
            if (row.fsType == FS_TYPE.FOLDER) {
                this.folderEnter(row.name);
                return;
            }
            if (!row.fsType)
                return alert("暂不支持当前格式.");
            window.open(`${FS_OPEN[row.fsType]}#${row.path}`);
        },
        openText(row) {
            window.open(`${FS_OPEN[FS_TYPE.TEXT]}#${row.path}`);
        },
        picBodyScroll(e) {
            // console.log(e);
            // e.currentTarget.scrollTo({
            //     left: e.currentTarget.scrollLeft - e.deltaY * 2,
            //     behavior: 'smooth'  // 平滑滚动
            // });
            e.currentTarget.scrollLeft -= e.deltaY
        },
        downloadFile(fileName) {
            location.href = downUrl(this.getPagePath() + fileName);
        },
        async uploadFile(batch = false) {
            if (this.pagePath.length < 1) {
                this.msg = '请先进入一个目录';
                return;
            }
            let files = await fileChooser(null, batch), msgList = [];
            if (!batch) {
                this.upload(files, msg => this.msg = msg);
                return;
            }
            for (let i = 0; i < files.length; i++) {
                msgList[i] = `${files[i].name} <mrun>waiting...</mrun>`;
            }
            this.msgList = msgList;
            for (let i = 0; i < files.length; i++) {
                await this.upload(files[i], msg => this.msgList[i] = msg );
            };
        },
        async upload(file, progress) {
            let formData = new FormData();
            formData.append("dir", '/home/liuyao' + this.getPagePath());
            formData.set("filename", file.name);
            formData.set("id", uuid());
            let start = 0, end, idx = 1, res;
            do {
                end = Math.min(file.size, start + PART_SIZE);
                formData.set("isLastPart", end >= file.size);
                formData.set("file", file.slice(start, end));
                res = await fileUpload("/bs-api/fs/uploadBigFile", formData, {
                    progress: e => {
                        progress(`${file.name} <mrun>${(start + e.loaded) / file.size * 100 | 0}%</mrun>`);
                    }
                });
                if('success' != res) {
                    progress(`${file.name} <mer>${res}</mer>`);
                    return;
                }
                start += PART_SIZE;
                idx++;
            } while (start < file.size);
            progress(`${file.name} <mok>success</mok>`);
        },
        getFilePreview(fsType, filepath) {
            let purl = openUrl(filepath);
            switch(fsType) {
                case FS_TYPE.FOLDER: return '<span class="icon icon-folder01"></span>';
                case FS_TYPE.IMAGE: return `<img src="${purl}">`;
                case FS_TYPE.VIDEO:
                    // let lastIndex = purl.lastIndexOf('/');
                    // let result = `${purl.slice(0, lastIndex)}/.vpr/${purl.slice(lastIndex + 1)}.jpg`;
                    // return `<img class="preview" src="${result}">`;
                    // /bs-api/fs
                    return `<img src="/bs-api/fs/videoPic?path=${encodeURIComponent('/home/liuyao'+filepath)}">`;
                default: return '<span class="icon icon-file01"></span>';
            }
        },
    },
}).mount("#app");

function calcFileLength(len) {
    let fixed = 1, unitSize = 1024, unit, lenUnit = ['T', 'G', 'M', 'K', 'B'];
    while(lenUnit.length > 0) {
        unit = lenUnit.pop();
        if (len < unitSize) return (len * 1.00).toFixed(fixed) * 1 + unit;
        len /= unitSize;
    }
    return (len * 1.00).toFixed(fixed) * 1 + 'T';
}

function fsMimeType(suffix = '') {
    switch (suffix.toLowerCase()) {
        case 'webp':
        case 'png':
        case 'jpeg':
        case 'jpg':
        case 'svg':
        case 'gif': return FS_TYPE.IMAGE;
        case 'mkv':
        case 'm4v':
        case 'webm':
        case 'mp4': return FS_TYPE.VIDEO;
        case 'txt':
        case 'md':
        case 'properties':
        case 'conf':
        case 'xml':
        case 'desktop':
        case 'log': return FS_TYPE.TEXT;
        default: return '';
    }
}

function getFileSuffix(nameOrPath) {
    // 从后往前数第几个
    let backNoTypeMap = {2: ['tar']};
    let split = nameOrPath.split('.');
    if (split.length < 2) {
        return '-';
    }
    for (const len in backNoTypeMap) {
        for (let i = 0; i < backNoTypeMap[len].length; i++) {
            if (split[split.length - len] == backNoTypeMap[len][i]) {
                return split.slice(split.length-len).join('.');
            }
        }
    }
    return split[split.length-1];
}

function calcNameLen(name) {
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
        sum += name.charCodeAt(i) < 127 && name.charCodeAt(i) > 31 ? 1 : 2;
    }
    console.log(`${sum} ${name}`)
    return sum;
}
