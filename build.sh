#!/bin/bash

# 获取并验证脚本环境
setup_script_environment() {
    local exit_cmd="exit 1"

    # 判断执行方式，选择正确的退出命令
    if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
        # 被 source 执行时使用 return
        exit_cmd="return 1"
    fi

    # 获取脚本所在目录的绝对路径（兼容两种执行方式）
    if [ -n "$GITHUB_WORKSPACE" ]; then
        # 在 GitHub Actions 环境中
        SCRIPT_DIR="$GITHUB_WORKSPACE"
        echo "检测到 GitHub Actions 环境，使用工作目录: $SCRIPT_DIR"
    else
        # 本地环境 - 使用 BASH_SOURCE 获取脚本真实路径
        local script_source="${BASH_SOURCE[0]:-$0}"
        SCRIPT_DIR="$(cd "$(dirname "$script_source")" && pwd)"
    fi

    # 验证关键目录是否存在
    local missing_dir=""

    if [ ! -d "${SCRIPT_DIR}/u-boot-2016" ]; then
        echo "错误: u-boot-2016 目录不存在"
        echo "期望路径: ${SCRIPT_DIR}/u-boot-2016"
        missing_dir="u-boot-2016"
    fi

    if [ ! -d "${SCRIPT_DIR}/staging_dir" ]; then
        if [ -n "$missing_dir" ]; then
            missing_dir="$missing_dir 和 staging_dir"
        else
            missing_dir="staging_dir"
        fi
        echo "错误: staging_dir 目录不存在"
        echo "期望路径: ${SCRIPT_DIR}/staging_dir"
    fi

    # 如果有缺失的目录，显示详细信息并退出
    if [ -n "$missing_dir" ]; then
        echo "缺失目录: $missing_dir"
        echo "当前目录内容:"
        ls -la "$SCRIPT_DIR"
        eval "$exit_cmd"
    fi

    # 验证通过，返回成功
    return 0
}

# 日志文件设置
LOG_FILE=""
setup_logging() {
    if [ ! -d "${SCRIPT_DIR}/bin/${COMPILE_DATE}" ]; then
        mkdir -p "${SCRIPT_DIR}/bin/${COMPILE_DATE}"
    fi

    if [ -z "$LOG_FILE" ]; then
        LOG_FILE="${SCRIPT_DIR}/bin/${COMPILE_DATE}/log-${COMPILE_DATE}.txt"
        echo "日志文件: $(basename "$LOG_FILE")"
        echo "==========================================" >> "$LOG_FILE"
        echo "编译开始时间: $(TZ=UTC-8 date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
        echo "编译版本号: $uboot_version" >> "$LOG_FILE"
        echo "==========================================" >> "$LOG_FILE"
    fi
}

# 日志输出函数
log_message() {
    local message="$*"
    local timestamp=$(TZ=UTC-8 date '+%Y-%m-%d %H:%M:%S')

    # 输出到标准输出
    echo "$message"

    # 输出到日志文件（带时间戳）
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp] $message" >> "$LOG_FILE"
    fi
}

# 设置编译时间信息
setup_build_info() {
    # 使用同一时间戳确保完全一致
    local unified_time=$(TZ=UTC-8 date +"%s")

    export COMPILE_DATE=$(TZ=UTC-8 date -d "@$unified_time" +"%y.%m.%d-%H.%M.%S")
    export uboot_version=$(TZ=UTC-8 date -d "@$unified_time" +"%y%m%d.%H%M%S")

    log_message "设置版本号: $uboot_version"
    log_message "设置编译时间: $COMPILE_DATE"

    # 设置日志文件
    setup_logging
}

# 设置编译环境函数
setup_build_env() {
    log_message "设置编译环境"
    export ARCH=arm
    export TARGETCC=arm-openwrt-linux-gcc
    export CROSS_COMPILE=arm-openwrt-linux-
    export STAGING_DIR="${SCRIPT_DIR}/staging_dir"
    export HOSTLDFLAGS="-L${STAGING_DIR}/usr/lib -znow -zrelro -pie"
    export PATH="${STAGING_DIR}/toolchain-arm_cortex-a7_gcc-5.2.0_musl-1.1.16_eabi/bin:$PATH"
}

# 检查编译依赖函数
check_dependencies() {
    local missing_deps=0
    local optional_missing=0

    setup_build_env
    echo "检查编译依赖"

    # 必需的系统工具
    local required_tools=(
        "make"
        "gcc"
        "g++"
        "arm-openwrt-linux-gcc"
        "arm-openwrt-linux-strip"
        "dtc"
        "python3"
        "perl"
        "truncate"
        "stat"
        "find"
        "rm"
        "mkdir"
        "cp"
        "mv"
    )

    # 可选工具（用于网页文件压缩）
    local optional_tools=(
        "html-minifier-terser"
        "cleancss"
        "terser"
    )

    # Perl 模块依赖
    local perl_modules=(
        "IO::Compress::Gzip"
    )

    # 获取工具版本号的函数
    get_version() {
        local tool=$1
        local version=""

        case $tool in
            "make")
                version=$(make --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "gcc")
                version=$(gcc --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "g++")
                version=$(g++ --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "arm-openwrt-linux-gcc")
                version=$($tool --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                [ -z "$version" ] && version=$($tool -dumpversion 2>/dev/null)
                ;;
            "arm-openwrt-linux-strip")
                version=$($tool --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "dtc")
                version=$(dtc --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "python3")
                version=$(python3 --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "perl")
                version=$(perl --version 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 | sed 's/v//')
                ;;
            "truncate")
                version=$(truncate --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                [ -z "$version" ] && version=$(coreutils --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "stat")
                version=$(stat --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                [ -z "$version" ] && version=$(coreutils --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "find")
                version=$(find --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                [ -z "$version" ] && version=$(findutils --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "rm"|"mkdir"|"cp"|"mv")
                version=$($tool --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                [ -z "$version" ] && version=$(coreutils --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
                ;;
            "html-minifier-terser")
                version=$(html-minifier-terser --version 2>/dev/null)
                ;;
            "cleancss")
                version=$(cleancss --version 2>/dev/null)
                ;;
            "terser")
                version=$(terser --version 2>/dev/null)
                ;;
            *)
                version=""
                ;;
        esac

        if [ -n "$version" ]; then
            echo "$version"
        else
            echo "未知版本"
        fi
    }

    # 检查必需工具
    echo "检查必需工具:"
    for tool in "${required_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            local version=$(get_version "$tool")
            echo "  ✓ $tool (版本: $version)"
        else
            echo "  ✗ $tool (缺失)"
            missing_deps=$((missing_deps + 1))
        fi
    done

    # 检查可选工具
    echo -e "\n检查可选工具（用于网页文件压缩）:"
    for tool in "${optional_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            local version=$(get_version "$tool")
            echo "  ✓ $tool (版本: $version)"
        else
            echo "  ✗ $tool (缺失 - 可选)"
            optional_missing=$((optional_missing + 1))
        fi
    done

    # 检查 Perl 模块
    echo -e "\n检查 Perl 模块:"
    for module in "${perl_modules[@]}"; do
        if perl -M"$module" -e "1" 2>/dev/null; then
            # 尝试获取模块版本
            local version=$(perl -M"$module" -e "print \$${module}::VERSION" 2>/dev/null)
            if [ -n "$version" ]; then
                echo "  ✓ $module (版本: $version)"
            else
                echo "  ✓ $module (版本未知)"
            fi
        else
            echo "  ✗ $module (缺失)"
            missing_deps=$((missing_deps + 1))
        fi
    done

    # 检查 Python3 模块
    echo -e "\n检查 Python3 模块:"
    if command -v python3 >/dev/null 2>&1; then
        local py_version=$(python3 --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)
        echo "  ✓ Python3 (版本: $py_version)"

        # 检查必要的 Python 模块
        local py_modules=("os" "sys" "struct")
        for py_mod in "${py_modules[@]}"; do
            if python3 -c "import $py_mod" 2>/dev/null; then
                echo "    ✓ $py_mod"
            else
                echo "    ✗ $py_mod (缺失)"
                missing_deps=$((missing_deps + 1))
            fi
        done
    else
        echo "  ✗ Python3 (无法运行)"
        missing_deps=$((missing_deps + 1))
    fi

    # 输出总结
    echo -e "\n=== 依赖检查总结 ==="
    if [ $missing_deps -eq 0 ]; then
        echo "所有必需依赖已满足 ✓"
        if [ $optional_missing -gt 0 ]; then
            echo "注意: 有 $optional_missing 个可选工具未安装"
            echo "      这将影响网页文件的压缩效果"
        fi
        return 0
    else
        echo "错误: 缺少 $missing_deps 个必需依赖 ✗"
        echo "请运行 'sudo ./build.sh install_deps' 安装缺失的依赖"
        return 1
    fi
}

# 安装编译依赖函数
install_dependencies() {
    # 检查是否以 root 权限运行
    if [ "$EUID" -ne 0 ]; then
        echo "错误: 安装依赖需要 root 权限"
        echo "请使用 sudo 运行此命令:"
        echo "  sudo ${BASH_SOURCE[0]} install_deps"
        return 1
    fi

    setup_build_env

    echo "开始安装编译依赖..."

    # 检测包管理器
    local pkg_manager=""
    local install_cmd=""
    local update_cmd=""

    if command -v apt >/dev/null 2>&1; then
        pkg_manager="apt"
        install_cmd="apt install -y"
        update_cmd="apt update"
    elif command -v yum >/dev/null 2>&1; then
        pkg_manager="yum"
        install_cmd="yum install -y"
        update_cmd="yum check-update"
    elif command -v dnf >/dev/null 2>&1; then
        pkg_manager="dnf"
        install_cmd="dnf install -y"
        update_cmd="dnf check-update"
    elif command -v pacman >/dev/null 2>&1; then
        pkg_manager="pacman"
        install_cmd="pacman -S --noconfirm"
        update_cmd="pacman -Sy"
    elif command -v apk >/dev/null 2>&1; then
        pkg_manager="apk"
        install_cmd="apk add"
        update_cmd="apk update"
    else
        echo "错误: 未找到支持的包管理器 (apt, yum, dnf, pacman, apk)"
        return 1
    fi

    echo "检测到包管理器: $pkg_manager"

    # 更新包索引
    echo "更新包索引..."
    eval "$update_cmd"

    # 安装基础开发工具
    echo "安装基础开发工具..."
    case $pkg_manager in
        apt)
            $install_cmd build-essential
            $install_cmd device-tree-compiler
            $install_cmd python3
            $install_cmd perl
            $install_cmd coreutils  # 提供 truncate 等工具
            $install_cmd nodejs npm  # 用于安装 html-minifier-terser, cleancss, terser
            ;;
        yum|dnf)
            $install_cmd gcc gcc-c++ make
            $install_cmd dtc
            $install_cmd python3
            $install_cmd perl
            $install_cmd coreutils
            $install_cmd nodejs npm
            ;;
        pacman)
            $install_cmd base-devel
            $install_cmd dtc
            $install_cmd python
            $install_cmd perl
            $install_cmd coreutils
            $install_cmd nodejs npm
            ;;
        apk)
            $install_cmd build-base
            $install_cmd dtc
            $install_cmd python3
            $install_cmd perl
            $install_cmd coreutils
            $install_cmd nodejs npm
            ;;
    esac

    # 安装 Perl 模块
    echo "安装 Perl 模块..."
    if command -v cpan >/dev/null 2>&1; then
        # 尝试使用包管理器安装 Perl 模块
        case $pkg_manager in
            apt)
                $install_cmd libio-compress-perl
                ;;
            yum|dnf)
                $install_cmd perl-IO-Compress
                ;;
            pacman)
                $install_cmd perl-io-compress
                ;;
            apk)
                $install_cmd perl-io-compress
                ;;
        esac

        # 如果包管理器安装失败，使用 cpan
        if ! perl -MIO::Compress::Gzip -e 1 2>/dev/null; then
            echo "尝试使用 cpan 安装 IO::Compress::Gzip..."
            cpan -i IO::Compress::Gzip
        fi
    else
        echo "警告: cpan 未安装，无法自动安装 Perl 模块"
        echo "请手动安装 Perl 模块 IO::Compress::Gzip"
    fi

    # 安装 Node.js 工具（用于网页文件压缩）
    echo "安装 Node.js 工具（用于网页文件压缩）..."
    if command -v npm >/dev/null 2>&1; then
        echo "安装 html-minifier-terser..."
        npm install -g html-minifier-terser

        echo "安装 clean-css-cli..."
        npm install -g clean-css-cli

        echo "安装 terser..."
        npm install -g terser
    else
        echo "警告: npm 未安装，无法安装 Node.js 工具"
        echo "如需网页文件压缩功能，请手动安装:"
        echo "  npm install -g html-minifier-terser clean-css-cli terser"
    fi

    # 检查工具链
    if ! command -v arm-openwrt-linux-gcc >/dev/null 2>&1; then
        echo -e "\n注意: 未找到 arm-openwrt-linux-gcc 工具链"
        echo "请确保工具链已安装并在 PATH 环境变量中"
        echo "工具链通常位于: ${SCRIPT_DIR}/staging_dir/toolchain-arm_cortex-a7_gcc-5.2.0_musl-1.1.16_eabi/bin/"
    fi

    echo "依赖安装完成！"
    echo "建议运行 './build.sh check_deps' 验证安装结果"
}

# 文件大小检查和填充函数
check_and_pad_file() {
    local file_path=$1
    local target_name=$2

    if [ ! -f "$file_path" ]; then
        log_message "错误: 文件不存在: $file_path"
        return 1
    fi

    local current_size_bytes=$(stat -c%s "$file_path")
    local target_size_bytes

    case "$target_name" in
        cmiot_ax18|qihoo_360v6|zn_m2)
            # 针对 NAND 机型，将 U-Boot 填充至 1536 KB
            target_size_bytes=1572864 # 1536 KB = 1572864 Bytes
            ;;
        *)
            target_size_bytes=655360 # 640 KB = 655360 Bytes
            ;;
    esac

    log_message "文件检查: $target_name"
    log_message "文    件: $(basename "$file_path")"
    log_message "当前大小: $current_size_bytes Bytes"
    log_message "目标大小: $target_size_bytes Bytes"

    if [ $current_size_bytes -lt $target_size_bytes ]; then
        log_message "文件当前大小小于目标大小，正在填充..."
        truncate -s $target_size_bytes "$file_path"
        local new_size_bytes=$(stat -c%s "$file_path")
        log_message "填充完成! 新大小: $new_size_bytes Bytes"
    elif [ $current_size_bytes -eq $target_size_bytes ]; then
        log_message "文件已经是目标大小!"
    else
        log_message "WARNING! 文件当前大小大于目标大小!"
        log_message "这可能导致刷写失败，建议检查编译配置"
    fi
}

# 清理编译过程中产生的缓存
clean_cache() {
    # 确保在脚本目录下执行
    cd "$SCRIPT_DIR"

    # 根据 .gitignore 规则深度清理
    if [ -d "${SCRIPT_DIR}/u-boot-2016" ]; then
        find u-boot-2016/ -type f \
            \( \
                -name '.*.cmd' -o \
                -name '.*.tmp' -o \
                -name '*.o' -o \
                -name '*.o.*' -o \
                -name '*.a' -o \
                -name '*.s' -o \
                -name '*.su' -o \
                -name '*.mod.c' -o \
                -name '*.i' -o \
                -name '*.lst' -o \
                -name '*.order' -o \
                -name '*.elf' -o \
                -name '*.swp' -o \
                -name '*.bin' -o \
                -name '*.patch' -o \
                -name '*.cfgtmp' -o \
                -name '*.exe' -o \
                -name 'MLO*' -o \
                -name 'SPL' -o \
                -name 'System.map' -o \
                -name 'LOG' -o \
                -name '*.orig' -o \
                -name '*~' -o \
                -name '#*#' -o \
                -name 'cscope.*' -o \
                -name 'tags' -o \
                -name 'ctags' -o \
                -name 'etags' -o \
                -name 'GPATH' -o \
                -name 'GRTAGS' -o \
                -name 'GSYMS' -o \
                -name 'GTAGS' \
            \) -delete
        rm -rf \
            u-boot-2016/.config \
            u-boot-2016/.gdb_history \
            u-boot-2016/.stgit-edit.txt \
            u-boot-2016/.u-boot* \
            u-boot-2016/arch/arm/dts/dtbtable.S \
            u-boot-2016/httpd/fsdata.c \
            u-boot-2016/include/config \
            u-boot-2016/include/generated \
            u-boot-2016/scripts/kconfig/conf \
            u-boot-2016/scripts/basic/fixdep \
            u-boot-2016/tools/gen_eth_addr \
            u-boot-2016/tools/img2srec \
            u-boot-2016/tools/proftool \
            u-boot-2016/tools/fdtgrep \
            u-boot-2016/tools/envcrc \
            u-boot-2016/tools/dumpimage \
            u-boot-2016/u-boot*
    fi
}

# 编译函数（先清理后编译）
compile_target_after_cache_clean() {
    local arch_name=$1
    local target_name=$2
    local config_name=$3

    log_message "编译目标: $target_name"

    # 清理编译缓存
    log_message "清理编译缓存"
    clean_cache

    # 设置编译环境
    setup_build_env

    log_message "进入编译目录"
    cd "${SCRIPT_DIR}/u-boot-2016/"

    log_message "构建配置: $config_name"
    make ${config_name}_defconfig

    log_message "开始编译"
    if [ -n "$LOG_FILE" ]; then
        # 同时输出到屏幕和日志文件
        make V=s 2>&1 | tee -a "$LOG_FILE"
        # 获取 make 命令的退出状态
        MAKE_EXIT_STATUS=${PIPESTATUS[0]}
    else
        # 如果没有日志文件，正常执行
        make V=s
        MAKE_EXIT_STATUS=$?
    fi

    if [ $MAKE_EXIT_STATUS -ne 0 ]; then
        log_message "错误: 编译失败!"
        return 1
    fi

    log_message "Strip elf"
    arm-openwrt-linux-strip u-boot

    log_message "转换 elf 到 mbn"
    python3 -B tools/elftombn.py -f ./u-boot -o ./u-boot.mbn -v 6

    if [ ! -d "${SCRIPT_DIR}/bin/${COMPILE_DATE}" ]; then
        mkdir -p "${SCRIPT_DIR}/bin/${COMPILE_DATE}"
    fi

	local output_file="${SCRIPT_DIR}/bin/${COMPILE_DATE}/uboot-${arch_name}-${target_name}-${uboot_version}.bin"
    log_message "移动 u-boot.mbn 到 bin/${COMPILE_DATE}/ 并重命名"
    mv ./u-boot.mbn "$output_file"

    # 调用文件大小检查和填充函数
    check_and_pad_file "$output_file" "$target_name"

    log_message "编译完成: $target_name"
    log_message " "

    # 返回脚本目录
    cd "$SCRIPT_DIR"
}

# 编译单个目标（包含版本设置）
compile_single_target() {
    local arch_name=$1
    local target_name=$2
    local config_name=$3

    setup_build_info

    compile_target_after_cache_clean "$arch_name" "$target_name" "$config_name"
}

# 编译所有目标
compile_all_targets() {
    # 一次性设置版本号，确保所有文件版本一致
    setup_build_info

    log_message "编译所有支持的设备"

    # 依次编译所有设备
    compile_target_after_cache_clean "ipq60xx" "cmiot_ax18"        "ipq6018_cmiot_ax18"
    compile_target_after_cache_clean "ipq60xx" "jdcloud_re-cs-02"  "ipq6018_jdcloud_re_cs_02"
    compile_target_after_cache_clean "ipq60xx" "jdcloud_re-cs-07"  "ipq6018_jdcloud_re_cs_07"
    compile_target_after_cache_clean "ipq60xx" "jdcloud_re-ss-01"  "ipq6018_jdcloud_re_ss_01"
    compile_target_after_cache_clean "ipq60xx" "link_nn6000"       "ipq6018_link_nn6000"
    compile_target_after_cache_clean "ipq60xx" "philips_ly1800"    "ipq6018_philips_ly1800"
    compile_target_after_cache_clean "ipq60xx" "qihoo_360v6"       "ipq6018_qihoo_360v6"
    compile_target_after_cache_clean "ipq60xx" "redmi_ax5-jdcloud" "ipq6018_redmi_ax5_jdcloud"
    compile_target_after_cache_clean "ipq60xx" "sy_y6010"          "ipq6018_sy_y6010"
    compile_target_after_cache_clean "ipq60xx" "zn_m2"             "ipq6018_zn_m2"

    log_message "所有设备编译完成!"
}

# 帮助文档函数
show_help() {
    echo "用法: ${BASH_SOURCE[0]} [选项]"
    echo ""
    echo "选项:"
    echo "  编译环境："
    echo "    setup_env                 设置编译环境 (需使用 source 执行 ${BASH_SOURCE[0]})"
    echo "    clean_cache               清理编译过程中产生的缓存"
    echo "    check_deps                检查编译依赖是否完整"
    echo "    install_deps              安装编译所需的依赖"
    echo "  设备："
    echo "    IPQ60xx:"
    echo "      build_ax18              编译 CMIOT AX18"
    echo "      build_re-cs-02          编译 JDCloud AX6600 (Athena)"
    echo "      build_re-cs-07          编译 JDCloud ER1"
    echo "      build_re-ss-01          编译 JDCloud AX1800 Pro (Arthur)"
    echo "      build_nn6000            编译 Link NN6000 (V1 & V2)"
    echo "      build_ly1800            编译 Philips LY1800"
    echo "      build_360v6             编译 Qihoo 360V6"
    echo "      build_ax5-jdcloud       编译 Redmi AX5 JDCloud"
    echo "      build_y6010             编译 SY Y6010"
    echo "      build_m2                编译 ZN M2"
    echo "    所有设备："
    echo "      build_all               编译所有支持的设备"
    echo "  其他："
    echo "    help                      显示此帮助信息"
}

# 以上是函数定义，脚本从这里开始执行

# 获取并验证脚本环境
setup_script_environment

# 主逻辑 - 使用 case 语句
case "$1" in
    "setup_env")
        if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
            echo "要在当前 shell 中设置编译环境，请执行: source ${BASH_SOURCE[0]} setup_env"
            exit 1
        fi
        setup_build_env
  		echo "编译环境设置完成"
        ;;

    "clean_cache")
        # 对于非编译操作，不设置日志文件
        clean_cache
        echo "编译缓存清理完成!"
        ;;

    "check_deps"|"check_dependencies")
        check_dependencies
        ;;

    "install_deps"|"install_dependencies")
        install_dependencies
        ;;

    "build_ax18")
        compile_single_target "ipq60xx" "cmiot_ax18" "ipq6018_cmiot_ax18"
        ;;

    "build_re-cs-02")
        compile_single_target "ipq60xx" "jdcloud_re-cs-02" "ipq6018_jdcloud_re_cs_02"
        ;;

    "build_re-cs-07")
        compile_single_target "ipq60xx" "jdcloud_re-cs-07" "ipq6018_jdcloud_re_cs_07"
        ;;

    "build_re-ss-01")
        compile_single_target "ipq60xx" "jdcloud_re-ss-01" "ipq6018_jdcloud_re_ss_01"
        ;;

    "build_nn6000")
        compile_single_target "ipq60xx" "link_nn6000" "ipq6018_link_nn6000"
        ;;

    "build_ly1800")
        compile_single_target "ipq60xx" "philips_ly1800" "ipq6018_philips_ly1800"
        ;;

    "build_360v6")
        compile_single_target "ipq60xx" "qihoo_360v6" "ipq6018_qihoo_360v6"
        ;;

    "build_ax5-jdcloud")
        compile_single_target "ipq60xx" "redmi_ax5-jdcloud" "ipq6018_redmi_ax5_jdcloud"
        ;;

    "build_y6010")
        compile_single_target "ipq60xx" "sy_y6010" "ipq6018_sy_y6010"
        ;;

    "build_m2")
        compile_single_target "ipq60xx" "zn_m2" "ipq6018_zn_m2"
        ;;

    "build_all")
        compile_all_targets
        ;;

    "help"|"")
        show_help
        ;;

    *)
        echo "错误: 未知选项 '$1'"
        echo "使用 '${BASH_SOURCE[0]} help' 查看可用选项"
        if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
            # 被 source 执行时使用 return
            return 1
        else
            exit 1
        fi
        ;;
esac

# 记录编译操作的结束
case "$1" in
    "build_"*)
        if [ -n "$LOG_FILE" ]; then
            echo "==========================================" >> "$LOG_FILE"
            echo "编译结束时间: $(TZ=UTC-8 date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
            echo "==========================================" >> "$LOG_FILE"
        fi
        ;;
esac
