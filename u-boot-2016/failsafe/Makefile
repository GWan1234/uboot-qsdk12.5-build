# SPDX-License-Identifier: GPL-2.0

ifneq ($(CONFIG_SPL_BUILD),y)

obj-y += fs.o failsafe.o

FS_GEN_SCRIPT := makefsdata
GEN_FILE := $(obj)/httpd-fsdata.c

# 生成httpd-fsdata.c的规则
quiet_cmd_gen_fsdata = GEN     $@
cmd_gen_fsdata = \
	cd $(srctree)/failsafe && \
	FSDATA_C=$(GEN_FILE) perl ./$(FS_GEN_SCRIPT)

$(GEN_FILE): $(srctree)/failsafe/$(FS_GEN_SCRIPT) $(wildcard $(srctree)/failsafe/fsdata/*)
	$(call cmd_gen_fsdata)

# fs.o依赖于生成的头文件
$(obj)/fs.o: $(GEN_FILE)

CLEAN_FILES += httpd-fsdata.c

endif
