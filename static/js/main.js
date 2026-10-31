
const PART_SIZE = 5*1024*1024;
const FS_OPEN = {};
const DATE_TEMP = new Date();
// 内网ip访问 用/会出问题
FS_OPEN[FS_TYPE.IMAGE] = 'open/img.html';
FS_OPEN[FS_TYPE.TEXT] = 'open/text.html';
FS_OPEN[FS_TYPE.VIDEO] = 'open/video.html';

const vm = Vue.createApp({
    data() {
        // let p = location.hash ? location.hash.slice(1) : localStorage.getItem('path');
        let p = location.search ? decodeURIComponent(location.search).slice(1, -1).trim() : "";
        let pagePath = ['/'];
        if(p) {
            pagePath = p.split('/');
            for (let i = 0; i < pagePath.length; i++) {
                pagePath[i] += '/';
            }
        }
        return {
            filterText: '',
            sortColumn: 'name',
            sortIsAsc: true,
            sortList: [
                { column: 'name', label: '名称', },
                { column: 'size', label: '大小', },
                { column: 'time', label: '时间', },
            ],
            isMobile: isMobile(),
            // isMobile: false,
            mode: localStorage.getItem('mode') || 'list',
            modeList: [
                { value: 'list',   label: '列表', },
                { value: 'column', label: '分栏', },
                { value: 'pic',    label: '图片', },
            ],
            msg: '',
            msgList: [],
            showHidden: 'true' === localStorage.getItem('showHidden'),
            pagePath: pagePath, // every ends with '/'
            /**
            { name, size, time, link, dir,  // api返回字段
                nameLen, sizeStr, timeStr, path, isHide
                "suffix": "", // zip, tar.gz, tar.zst
                "fsType": "", // FS_TYPE
            } */
            allFiles: [],
            files: [],
            fileTree: []
        }
    },
    computed: {
        // files() {
        //     // 根据条件返回对应的数据源
        //     return this.showHidden ? this.allFiles : this.normalFiles;
        // },
    },
    watch: {
        pagePath: {
            // splice方式 在这里触发时nv和ov是同一个引用都是nv值
            handler(nv, ov) {
                // history.pushState(state, title, url);
                history.replaceState(null, '', '?' + encodeURIComponent(this.getPagePath()));
            },
            deep: true
        },
        showHidden(nv, ov) {
            this.filesFilter();
            this.filesSort();
        },
        filterText(nv, ov) {
            this.filesFilter();
            this.filesSort();
        },
    },
    created() {
        this.getFiles();
        window.addEventListener("popstate", e => {
            // if (this.pagePath.length <= 1 && confirm('离开页面?')) {
            // }
        });
    },
    methods: {
        async getFiles() {
            let pp = this.getPagePath();
            // pp = pp && !pp.endsWith('/') ? (pp + '/') : (pp || '/');
            localStorage.setItem('path', pp);
            let resp = await fetch(listUrl(pp));
            let res = await resp.json();
            if (200 != resp.status) {
                this.allFiles = [{name: `${res.code}: ${res.msg}`}];
                this.normalFiles = this.allFiles;
                return;
            }
            let suff;
            for (let i = 0; i < res.length; i++) {
                suff = fsMimeType(res[i].name, res[i].dir);
                res[i].sizeStr = res[i].dir ? '-' : calcFileLength(res[i].size);
                res[i].size = res[i].dir ? '0' : res[i].size;
                res[i].timeStr = dateFormat(res[i].time);
                res[i].suffix = suff[1];
                res[i].fsType = suff[0];
                res[i].path = `${this.getPagePath()}${res[i].name}`;
                res[i].preview = this.getFilePreview(res[i].fsType, res[i].path);
                res[i].nameLen = calcNameLen(res[i].name);
                res[i].isHide = res[i].name[0] == '.';
            }
            this.allFiles = res;
            // this.normalFiles = res.filter(f => f.name[0] != '.');
            // this.reSort('name', 'asc');
            this.filesFilter();
            this.filesSort();
            // 回到页头
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        },
        filesFilter() {
            let hl_key_arr = hl_keys(this.filterText);
            this.files = this.allFiles.filter(row => {
                // .开头隐藏文件
                if (!this.showHidden && row.isHide) return false;
                // 文本过滤
                if (hl_key_arr) {
                    let n = row.name.toLowerCase();
                    if(!hl_check(hl_key_arr, n)) return false;
                    row.nameHtml = hl_replace(row.name, n, hl_key_arr);
                } else {
                    row.nameHtml = row.name;
                }
                return true;
            });
        },
        filesSort() {
            let compareName = (f1, f2) => {
                let f1Name = f1.name.toLowerCase(),
                    f2Name = f2.name.toLowerCase(),
                    min = Math.min(f1Name.length, f2Name.length);
                for (let i = 0; i < min; i++)
                    if (f1Name[i] != f2Name[i])
                        return f1Name.charCodeAt(i) - f2Name.charCodeAt(i);
                return f1Name.length - f2Name.length;
            };
            this.files.sort((f1, f2) => {
                // 不管升序降序 文件夹 和 .xxx 都要排前， 而且要文件夹优先
                if (f1.dir !== f2.dir) return f1.dir ? -1 : 1;
                if (f1.isHide !== f2.isHide) return f1.isHide ? -1 : 1;
                // 尺寸排序 文件夹总以名字升序排序 不做升降
                if (f1.dir && this.sortColumn == 'size') return compareName(f1, f2);
                let compare = (f1, f2, column) => {
                    switch (column) {
                        case 'name': return compareName(f1, f2);
                        case 'size': return f1.size - f2.size;
                        case 'time': return f1.time - f2.time;
                        default:  return compare(f1, f2, 'name');
                    }
                }
                return (this.sortIsAsc ? 1 : -1) * compare(f1, f2, this.sortColumn);
            });
        },
        sortClick(sortColumn = 'name') {
            this.sortColumn = sortColumn || 'name';
            this.sortIsAsc = this.sortColumn != sortColumn || !this.sortIsAsc;
            this.filesSort();
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
            return this.sortColumn == column ? (this.sortIsAsc ? 'icon icon-sort-up' : 'icon icon-sort-down') : '';
        },
        toggleShowHidden() {
            this.showHidden = !this.showHidden;
            localStorage.setItem('showHidden', this.showHidden);
        },
        switchMode(mode) {
            this.mode = mode;
            localStorage.setItem('mode', mode);
        },
        folderEnter(folderName) {
            this.pagePath.push(folderName + "/");
            this.getFiles();
            this.filterText = '';
        },
        folderLeave() {
            if (this.pagePath.length <= 1) {
                return;
            }
            this.pagePath.pop();
            this.getFiles();
            this.filterText = '';
        },
        gotoPagePath(idx) {
            console.log(idx);
            this.pagePath.splice(Math.max(1, idx + 1));
            this.getFiles();
        },
        getPagePath() {
            return this.pagePath.join('');
        },
        clickName(row) {
            if (row.fsType == FS_TYPE.FOLDER) {
                this.folderEnter(row.name);
                return;
            }
            if (!FS_OPEN[row.fsType])
                return alert("暂不支持当前格式.");
            let sendData = null;
            switch(row.fsType) {
                case FS_TYPE.VIDEO:
                    sendData = [];
                    this.files.forEach(f => {
                        if (f.fsType == FS_TYPE.VIDEO) sendData.push(f.name);
                    })
                    break;
            }
            openFile(true, FS_OPEN[row.fsType], row.path, sendData);
        },
        openText(row) {
            openFile(true, FS_OPEN[FS_TYPE.TEXT], row.path);
        },
        picBodyScroll(e) {
            // console.log(e);
            // e.currentTarget.scrollTo({
            //     left: e.currentTarget.scrollLeft - e.deltaY * 2,
            //     behavior: 'smooth'  // 平滑滚动
            // });
            e.currentTarget.scrollLeft += e.deltaY
        },
        downloadFile(fileName) {
            location.href = downUrl(this.getPagePath() + fileName);
        },
        async uploadFile(batch = true) {
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
                msgList[i] = `<mrun>waiting...</mrun> ${files[i].name}`;
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
                res = await fileUpload("/bs/fs/uploadBigFile", formData, {
                    progress: e => {
                        progress(`<mrun>${(start + e.loaded) / file.size * 100 | 0}%</mrun> ${file.name}`);
                    }
                });
                if('success' != res) {
                    progress(`<mer>${res}</mer> ${file.name}`);
                    return;
                }
                start += PART_SIZE;
                idx++;
            } while (start < file.size);
            progress(`<mok>success</mok> ${file.name}`);
        },
        getFilePreview(fsType, filepath) {
            let purl = openUrl(filepath);
            switch(fsType) {
                case FS_TYPE.FOLDER: return '<span class="icon icon-folder01"></span>';
                case FS_TYPE.IMAGE: return `<img src="${purl}">`;
                case FS_TYPE.VIDEO:
                    let lastIndex = purl.lastIndexOf('/');
                    let result = `${purl.slice(0, lastIndex)}/.vpr/${purl.slice(lastIndex + 1)}.jpg`;
                    fetch(videoPicUrl(filepath));
                    return `<img class="preview" src="${result}">`;
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

function calcNameLen(name) {
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
        sum += name.charCodeAt(i) < 127 && name.charCodeAt(i) > 31 ? 1 : 2;
    }
    return sum;
}

// 处理 keys, 排除包含
function hl_keys(keys) {
    if (!keys.trim()) return null;
    keys = keys.toLowerCase().split(' ');
    for (let i = 0; i < keys.length - 1; i++) {
        if (!keys[i]) continue;
        for (let j = i + 1; j < keys.length; j++) {
            if (!keys[j]) continue;
            if (keys[i].indexOf(keys[j]) >= 0) {
                keys[j] = '';
            }
        }
    }
    return keys.filter(k => k);
}

/** 
 * arr所有都满足
 * @return bool
 */
function hl_check(hl_key_arr, str_lower) {
    for(let k of hl_key_arr) {
        if (str_lower.indexOf(k) < 0) return false;
    }
    return true;
}

/**
 * 只管高亮（不区分大小写）
 * @param hl_key_arr = hl_keys(keystr), 全小写
 * @return array, 如果需要字符串, 调用 .join('');
 */
function hl_replace(str_origin, str_lower, hl_key_arr, hl_start = '<hl>', hl_end = '</hl>') {
    let key_bit = new Array(str_lower.length).fill(0), key_idx;
    for (let k of hl_key_arr) {
        key_idx = -1;
        while((key_idx = str_lower.indexOf(k, key_idx + 1)) >= 0) {
            // 设置匹配到的标志位为1
            key_bit.fill(1, key_idx, key_idx + k.length);
        }
    }
    let res = [], prev_bit = 0;
    // 合并 且 加上高亮字符串
    for (let i = 0; i < str_lower.length; i++) {
        // 原始字符 对位到 结果数组
        res[i] = str_origin[i];
        // 前后相同 无需额外操作
        if (key_bit[i] == prev_bit) continue;
        // 根据后一位0/1判断追加的是头还是尾
        res[i] = (key_bit[i] == 0 ? hl_end : hl_start ) + str_origin[i];
        prev_bit = key_bit[i];
    }
    // 尾部补漏
    if (key_bit[key_bit.length-1] == 1) {
        res[res.length-1] += hl_end; 
    }
    return res ? res.join('') : '';
}