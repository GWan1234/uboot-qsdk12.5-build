#include <common.h>
#include <cli.h>
#include <errno.h>
#include <ipq_api.h>
#include <fdtdec.h>
#include <dt-bindings/gpio/gpio.h>
#include <part.h>
#include <mmc.h>
#include <sdhci.h>
#include <spi.h>
#include <spi_flash.h>
#include <asm/arch-qca-common/smem.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <ubi_uboot.h>
#include <failsafe/fw.h>
#include <mapmem.h>
#include <flashrw.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

typedef struct {
	unsigned int gpio;
	unsigned int active_level;
} led_info_t;

typedef struct {
	const char *name;
	unsigned int gpio;
	unsigned int active_level;
} button_info_t;

detected_flash_device_t detected_flash_device;

DECLARE_GLOBAL_DATA_PTR;

void ipq_gpio_init(void)
{
	int node;
	const char *node_paths[] = {
		"/tlmm-gpio/led_gpio",
		"/tlmm-gpio/key_gpio"
	};

	for (int i = 0; i < ARRAY_SIZE(node_paths); i++) {
		node = fdt_path_offset(gd->fdt_blob, node_paths[i]);
		if (node >= 0)
			qca_gpio_init(node);
	}
}

static int fdt_get_led_info_by_label(const char *led_label, led_info_t *led_info)
{
	int parent, node;
	int ret, strings_count;
	const char *node_label;

	if (!led_label)
		return -EINVAL;

	parent = fdt_path_offset(gd->fdt_blob, "/tlmm-gpio/led_gpio");
	if (parent < 0)
		return -ENOENT;

	fdt_for_each_subnode(gd->fdt_blob, node, parent) {
		strings_count = fdt_count_strings(gd->fdt_blob, node, "label");
		for (int i = 0; i < strings_count; i++) {
			node_label = NULL;
			ret = fdt_get_string_index(gd->fdt_blob, node, "label", i, &node_label);
			if (!ret && node_label && !strcmp(node_label, led_label)) {
				led_info->gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
				led_info->active_level = fdtdec_get_uint(gd->fdt_blob, node, "active_level", GPIO_ACTIVE_HIGH);
				return 0;
			}
		}
	}

	return -ENOENT;
}

void led_on(const char *label)
{
	int ret;
	led_info_t led;

	ret = fdt_get_led_info_by_label(label, &led);
	if (!ret && led.gpio)
		gpio_set_value(led.gpio,
			(led.active_level == GPIO_ACTIVE_HIGH) ? GPIO_OUT_HIGH : GPIO_OUT_LOW);
}

void led_off(const char *label)
{
	int ret;
	led_info_t led;

	ret = fdt_get_led_info_by_label(label, &led);
	if (!ret && led.gpio)
		gpio_set_value(led.gpio,
			(led.active_level == GPIO_ACTIVE_HIGH) ? GPIO_OUT_LOW : GPIO_OUT_HIGH);
}

void led_toggle(const char *label)
{
	int ret;
	led_info_t led;

	ret = fdt_get_led_info_by_label(label, &led);
	if (!ret && led.gpio)
		gpio_set_value(led.gpio, !gpio_get_value(led.gpio));
}

static inline bool is_button_pressed(unsigned int button_gpio, unsigned int active_level)
{
	unsigned int button_pressed = (active_level == GPIO_ACTIVE_LOW) ? GPIO_OUT_LOW : GPIO_OUT_HIGH;
	return (gpio_get_value(button_gpio) == button_pressed) ? true : false;
}

static bool is_any_button_pressed(button_info_t *button_info)
{
	int parent, node;
	unsigned int gpio, active_level;

	parent = fdt_path_offset(gd->fdt_blob, "/tlmm-gpio/key_gpio");
	if (parent < 0)
		return false;

	fdt_for_each_subnode(gd->fdt_blob, node, parent) {
		gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
		active_level = fdtdec_get_uint(gd->fdt_blob, node, "active_level", GPIO_ACTIVE_LOW);
		if (gpio && is_button_pressed(gpio, active_level)) {
			button_info->name = fdt_get_name(gd->fdt_blob, node, NULL);
			button_info->gpio = gpio;
			button_info->active_level = active_level;
			return true;
		}
	}

	return false;
}

static bool is_any_button_pressed_for_enough_time(void)
{
	int counter = 3;
	ulong ts;
	bool led_state_on, still_pressed = true;
	button_info_t button;

    if (!is_any_button_pressed(&button))
		return false;

	printf("%s button pressed, enter web failsafe mode after: %-2d", button.name, counter);

	while (counter > 0 && still_pressed) {
		counter--;
		ts = get_timer(0);
		led_state_on = false;
		led_off("power_led");
		do {
			still_pressed = is_button_pressed(button.gpio, button.active_level);

			if (!led_state_on && get_timer(ts) >= 500) {
				led_state_on = true;
				led_on("power_led");
			}

			udelay(10000);
		} while (still_pressed && get_timer(ts) < 1000);

		printf("\b\b%-2d", counter);
	}

	putc('\n');
	led_on("power_led");

	return still_pressed;
}

static bool failsafe_env_exists(void)
{
	const char *failsafe_start_mode = getenv("failsafe");

	if (!failsafe_start_mode)
		return false;

	if (strcmp(failsafe_start_mode, "always")) {
		/* 非 always 模式，删除 failsafe 环境变量，防止重启后再次启动 httpd */
		setenv("failsafe", NULL);
		saveenv();
	}

	return true;
}

void do_httpd_check(void)
{
	ulong ts;
	int counter = 3;
	bool led_state_on, abort = false, start_httpd = false;

	if (is_9008_mode || failsafe_env_exists()) {
		puts(is_9008_mode ? "currently in 9008 mode" : "failsafe env variable defined");
		printf(", enter web failsafe mode after: %-2d", counter);

		/* Wait 3s for phy link to settle down */
		while (!abort && counter > 0) {
			counter--;
			ts = get_timer(0);
			led_state_on = false;
			led_off("power_led");

			do {
				if (tstc()) { /* we got a key press	*/
					abort = true;
					counter = 0;
					(void) getc(); /* consume input	*/
					break;;
				}
				if (!led_state_on && get_timer(ts) >= 500) {
					led_state_on = true;
					led_on("power_led");
				}
				udelay(10000);
			} while (!abort && get_timer(ts) < 1000);

			printf("\b\b%-2d", counter);
		}

		putc('\n');
		led_on("power_led");
		start_httpd = true;
	}

	if (!start_httpd)
		start_httpd = is_any_button_pressed_for_enough_time();

	if (abort) {
		led_on("power_led");
		cli_loop();
	}

	if (start_httpd) {
		run_command("httpd", 0);
		cli_loop();
	}
}

#if defined(CONFIG_FORCE_NETWORK_ENV)
void check_network_settings(void)
{
	if (getenv("custom_network"))
		return;

	int modified = 0;
	const char *current_ipaddr, *current_netmask, *current_serverip;
	const char *default_ipaddr, *default_netmask, *default_serverip;

# if defined(CONFIG_IPADDR)
	default_ipaddr = __stringify(CONFIG_IPADDR);
# else
	default_ipaddr = "192.168.1.1";
# endif /* CONFIG_IPADDR */
# if defined(CONFIG_NETMASK)
	default_netmask = __stringify(CONFIG_NETMASK);
# else
	default_netmask = "255.255.255.0";
# endif /* CONFIG_NETMASK */
# if defined(CONFIG_SERVERIP)
	default_serverip = __stringify(CONFIG_SERVERIP);
# else
	default_serverip = "192.168.1.2";
# endif /* CONFIG_SERVERIP */

	current_ipaddr = getenv("ipaddr");
	current_netmask = getenv("netmask");
	current_serverip = getenv("serverip");

	if (!current_ipaddr || strcmp(current_ipaddr, default_ipaddr)) {
		setenv("ipaddr", default_ipaddr);
		net_ip = string_to_ip(default_ipaddr);
		modified++;
	}

	if (!current_netmask || strcmp(current_netmask, default_netmask)) {
		setenv("netmask", default_netmask);
		net_netmask = string_to_ip(default_netmask);
		modified++;
	}

	if (!current_serverip || strcmp(current_serverip, default_serverip)) {
		setenv("serverip", default_serverip);
		net_server_ip = string_to_ip(default_serverip);
		modified++;
	}

	if (modified) {
		printf("\"custom_network\" env variable not defined, "
			"reset network settings to default values:\n");
		printf("    ipaddr: %s\n", default_ipaddr);
		printf("    netmask: %s\n", default_netmask);
		printf("    serverip: %s\n", default_serverip);
		saveenv();
	}
}
#endif /* CONFIG_FORCE_NETWORK_ENV */

void detect_flash_device(void)
{
	int len = 0;
	char flash_list[25];
	struct spi_flash *spi;
	block_dev_desc_t *mmc_dev;
	nand_info_t *nand;
	detected_flash_device_t *dfd = &detected_flash_device;

	dfd->spi = false;
	dfd->nand = false;
	dfd->mmc = false;

	spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
			CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
	if (spi) {
		len += strlcpy(flash_list + len, "SPI", sizeof(flash_list));
		dfd->spi = true;
	}

	nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
	if (nand->name) {
		len += sprintf(flash_list + len, "%sNAND", len ? ", " : "");
		dfd->nand = true;
	}

	mmc_dev = mmc_get_dev(mmc_host.dev_num);
	if (mmc_dev && mmc_dev->type != DEV_TYPE_UNKNOWN) {
		len += sprintf(flash_list + len, "%sMMC", len ? ", " : "");
		dfd->mmc = true;
	}

	flash_list[len] = '\0';

	printf("FLASH(S): %s\n", len ? flash_list : "NONE");
}

/**
 * json_escape - 对字符串进行JSON转义处理
 * @input: 要转义的输入字符串（可以为NULL）
 * @output: 存储转义后字符串的输出缓冲区
 * @output_buffer_size: 输出缓冲区的大小（字节）
 *
 * 该函数将输入字符串中的特殊字符转义为JSON兼容的格式，包括：
 *   - 双引号转义为 \"
 *   - 反斜杠转义为 \\
 *   - 换行符转义为 \n
 *   - 回车符转义为 \r
 *   - 制表符转义为 \t
 *   - 其他控制字符（< 0x20）替换为空格
 *   - 普通字符保持不变
 *
 * 返回值：写入输出缓冲区的字符数（不包括结尾的'\0'）
 */
size_t json_escape(const char *input, char *output, size_t output_buffer_size)
{
	int j = 0;

    if (!output || !output_buffer_size)
        return 0;

    if (!input)
        goto done;

    for (int i = 0; input[i] && j < output_buffer_size - 1; i++) {
        switch (input[i]) {
        case '"':
        case '\\':
            if (j + 2 >= output_buffer_size)
                goto done;
            output[j++] = '\\';
            output[j++] = input[i];
            break;
        case '\n':
        case '\r':
        case '\t':
            if (j + 2 >= output_buffer_size)
                goto done;
            output[j++] = '\\';
            if (input[i] == '\n')
                output[j++] = 'n';
            else if (input[i] == '\r')
                output[j++] = 'r';
            else
                output[j++] = 't';
            break;
        default:
            if ((unsigned char)input[i] < 0x20)
                output[j++] = ' ';
            else
                output[j++] = input[i];
        }
    }

done:
    output[j] = '\0';
    return j;
}

bool mmc_part_exists(const char *part_name)
{
	int ret;
	block_dev_desc_t *mmc_dev;
	disk_partition_t disk_info = {0};
	detected_flash_device_t *dfd = &detected_flash_device;

	if (!dfd->mmc)
		return false;

	mmc_dev = mmc_get_dev(mmc_host.dev_num);
	if (!mmc_dev)
		return false;

	ret = get_partition_info_efi_by_name(mmc_dev, part_name, &disk_info);

	return ret ? false : true;
}

const char *flash_type_to_string(const uint32_t flash_type)
{
    switch (flash_type) {
    case SMEM_BOOT_NO_FLASH: return NO_FLASH_STR;
    case SMEM_BOOT_NOR_FLASH: return NOR_FLASH_STR;
    case SMEM_BOOT_NAND_FLASH: return NAND_FLASH_STR;
    case SMEM_BOOT_ONENAND_FLASH: return ONENAND_FLASH_STR;
    case SMEM_BOOT_SDC_FLASH: return SDC_FLASH_STR;
    case SMEM_BOOT_MMC_FLASH: return MMC_FLASH_STR;
    case SMEM_BOOT_SPI_FLASH: return SPI_FLASH_STR;
    case SMEM_BOOT_NORPLUSNAND: return NORPLUSNAND_STR;
    case SMEM_BOOT_NORPLUSEMMC: return NORPLUSEMMC_STR;
    case SMEM_BOOT_QSPI_NAND_FLASH: return QSPI_NAND_FLASH_STR;
    default: return UNKNOWN_FLASH_STR;
    }
}

int string_to_flash_type(const char *str)
{
    if (!strcasecmp(str, NO_FLASH_STR))
        return SMEM_BOOT_NO_FLASH;
    else if (!strcasecmp(str, NOR_FLASH_STR))
        return SMEM_BOOT_NOR_FLASH;
    else if (!strcasecmp(str, NAND_FLASH_STR))
        return SMEM_BOOT_NAND_FLASH;
    else if (!strcasecmp(str, ONENAND_FLASH_STR))
        return SMEM_BOOT_ONENAND_FLASH;
    else if (!strcasecmp(str, SDC_FLASH_STR))
        return SMEM_BOOT_SDC_FLASH;
    else if (!strcasecmp(str, MMC_FLASH_STR))
        return SMEM_BOOT_MMC_FLASH;
    else if (!strcasecmp(str, SPI_FLASH_STR))
        return SMEM_BOOT_SPI_FLASH;
    else if (!strcasecmp(str, NORPLUSNAND_STR))
        return SMEM_BOOT_NORPLUSNAND;
    else if (!strcasecmp(str, NORPLUSEMMC_STR))
        return SMEM_BOOT_NORPLUSEMMC;
    else if (!strcasecmp(str, QSPI_NAND_FLASH_STR))
        return SMEM_BOOT_QSPI_NAND_FLASH;
    else
        return -1;
}

const void *get_mibib_ptable_offset(const void *addr, size_t limit, mibib_type_t mibib_type)
{
	const void *p = addr;
	const u64 magic_mibib_start = HEADER_MAGIC_MBN;
	const u64 magic_ptable_start = HEADER_MAGIC_PTABLE;
	const u64 magic_ptable_end = FOOTER_MAGIC_MBN;
	const size_t magic_len = sizeof(u64);
	uint32_t ptable_start_in_mibib, ptable_end_in_mibib;

	if (!p)
		return NULL;

	switch (mibib_type) {
	case MIBIB_TYPE_NAND:
		ptable_start_in_mibib = PTABLE_START_IN_MIBIB_NAND;
		ptable_end_in_mibib = PTABLE_END_IN_MIBIB_NAND;
		break;
	case MIBIB_TYPE_NOR:
		ptable_start_in_mibib = PTABLE_START_IN_MIBIB_NOR;
		ptable_end_in_mibib = PTABLE_END_IN_MIBIB_NOR;
		break;
	default:
		return NULL;
	}

	while (limit >= ptable_end_in_mibib + magic_len) {
		limit--;
		if (!memcmp(p, &magic_mibib_start, magic_len) &&
			!memcmp(p + ptable_start_in_mibib, &magic_ptable_start, magic_len) &&
			!memcmp(p + ptable_end_in_mibib, &magic_ptable_end, magic_len)) {
			return p + ptable_start_in_mibib;
		}
		p++;
	}

	return NULL;
}

static int reload_mibib_from_spi(void)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	struct spi_flash *spi;
	size_t read_size;
	void *load_addr;
	const void *mibib_ptable;
	int ret;

	spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
			CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
	if (!spi)
		return -ENODEV;

	/* 读取 SPI-NOR 的前 2 MiB 数据 */
	read_size = min_t(size_t, SZ_MIB(2), spi->size);

	load_addr = map_sysmem(CONFIG_SYS_LOAD_ADDR, read_size);
	if (!load_addr)
		return -ENOMEM;

	ret = read_data_from_spi(0, read_size, load_addr, read_size);
	if (ret)
		goto done;

	mibib_ptable = get_mibib_ptable_offset(load_addr, read_size, MIBIB_TYPE_NOR);
	if (!mibib_ptable) {
		ret = -ENOENT;
		goto done;
	}

	ret = mibib_ptable_init((unsigned int *)mibib_ptable);
	if (ret)
		goto done;

	ret = 0;

	sfi->flash_type = SMEM_BOOT_SPI_FLASH;
	sfi->flash_block_size = spi->erase_size;
	sfi->flash_density = spi->size;

	get_kernel_fs_part_details();

done:
	puts("try reloading MIBIB from SPI: ");
	if (ret)
		printf("failure (errno: %d)\n", ret);
	else
		puts("success\n");
	unmap_sysmem(load_addr);
	return ret;
}

static int reload_mibib_from_nand(void)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	nand_info_t *nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
	size_t read_size;
	void *load_addr;
	const void *mibib_ptable;
	int ret;

	/* 读取 NAND 的前 4 MiB 数据 */
	read_size = min_t(size_t, SZ_MIB(4), nand->size);

	load_addr = map_sysmem(CONFIG_SYS_LOAD_ADDR, read_size);
	if (!load_addr)
		return -ENOMEM;

	ret = read_data_from_nand(0, read_size, load_addr, read_size);
	if (ret)
		goto done;

	mibib_ptable = get_mibib_ptable_offset(load_addr, read_size, MIBIB_TYPE_NAND);
	if (!mibib_ptable) {
		ret = -ENOENT;
		goto done;
	}

	ret = mibib_ptable_init((unsigned int *)mibib_ptable);
	if (ret)
		goto done;

	ret = 0;

#ifdef CONFIG_QPIC_SERIAL
	sfi->flash_type = SMEM_BOOT_QSPI_NAND_FLASH;
#else
	sfi->flash_type = SMEM_BOOT_NAND_FLASH;
#endif
	sfi->flash_block_size = nand->erasesize;
	sfi->flash_density = nand->size;

	get_kernel_fs_part_details();

done:
	puts("try reloading MIBIB from NAND: ");
	if (ret)
		printf("failure (errno: %d)\n", ret);
	else
		puts("success\n");
	unmap_sysmem(load_addr);
	return ret;
}

void reload_mibib_from_flash_in_9008_mode(void)
{
	detected_flash_device_t *dfd = &detected_flash_device;

	if (!is_9008_mode)
		return;

	if (dfd->spi && !reload_mibib_from_spi())
		return;

	if (dfd->nand)
		reload_mibib_from_nand();
}

/**
 * 9008 模式下，根据检测到的 FLASH 设备设置默认 flash type。
 * 后续可通过 "bootflash set nor/nand/mmc" 命令手动切换 flash type。
 */
void set_default_flash_type_in_9008_mode(void)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	detected_flash_device_t *dfd = &detected_flash_device;

	if (!is_9008_mode)
		return;

	/* SPI-NOR 具有最高优先级 */
	if (dfd->spi) {
		sfi->flash_type = SMEM_BOOT_SPI_FLASH;
		return;
	}

	/* 只有 NAND 存在 */
	if (dfd->nand && !dfd->mmc) {
#ifdef CONFIG_QPIC_SERIAL
		sfi->flash_type = SMEM_BOOT_QSPI_NAND_FLASH;
#else
		sfi->flash_type = SMEM_BOOT_NAND_FLASH;
#endif
		return;
	}

	/* 只有 eMMC 存在 */
	if (dfd->mmc && !dfd->nand) {
		sfi->flash_type = SMEM_BOOT_MMC_FLASH;
		return;
	}

	/* 其他情况不做修改 */
	return;
}
