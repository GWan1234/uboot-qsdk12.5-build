# SPDX-License-Identifier: GPL-2.0

ifneq ($(CONFIG_SPL_BUILD),y)

obj-y += fs.o failsafe.o

FS_GEN_SCRIPT := makefsdata
FSDATA_C := $(obj)/httpd-fsdata.c

quiet_cmd_gen_fsdata = GEN     $@
cmd_gen_fsdata = \
	cd $(srctree)/failsafe && \
	rm -rf httpd-fsdata.c && \
	perl ./$(FS_GEN_SCRIPT)

$(FSDATA_C): $(srctree)/failsafe/$(FS_GEN_SCRIPT) $(wildcard $(srctree)/failsafe/fsdata/*)
	$(call cmd_gen_fsdata)

$(obj)/fs.o: $(FSDATA_C)

CLEAN_FILES += $(GEN_FILE)

endif
