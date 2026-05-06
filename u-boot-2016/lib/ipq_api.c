#include <common.h>
#include <cli.h>
#include <ipq_api.h>
#include <asm/gpio.h>
#include <fdtdec.h>
#include <part.h>
#include <mmc.h>
#include <sdhci.h>
#include <spi.h>
#include <spi_flash.h>
#include <asm/arch-qca-common/smem.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <ubi_uboot.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

detected_flash_device_t detected_flash_device;

DECLARE_GLOBAL_DATA_PTR;

unsigned int fdt_get_gpio_by_name(const char *gpio_name, const int debug_state) {
	int node;
	unsigned int gpio;

	node = fdt_path_offset(gd->fdt_blob, gpio_name);
	if (node < 0) {
		if (debug_state)
			printf("Could not find %s node in fdt\n", gpio_name);
		return 0;
	}

	gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
	if (!gpio) {
		if (debug_state)
			printf("Could not find %s node's gpio in fdt\n", gpio_name);
		return 0;
	}

	return gpio;
}

void led_toggle(const char *gpio_name) {
	int value;
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name, 1);
	if (!gpio)
		return;

	value = gpio_get_value(gpio);
	value = !value;
	gpio_set_value(gpio, value);

	return;
}

void led_on(const char *gpio_name) {
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name, 1);
	if (!gpio)
		return;

	gpio_set_value(gpio, 1);

	return;
}

void led_off(const char *gpio_name) {
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name, 1);
	if (!gpio)
		return;

	gpio_set_value(gpio, 0);

	return;
}

/**
 * check_button_is_pressed - 检测特定按键是否被按下
 *
 * @gpio_name: 按键名称（在 DTS 的 aliases 中定义）
 * @value: 代表按键被按下的电平值
 */
bool button_is_pressed(const char *gpio_name, int value) {
	unsigned int gpio;

	if (strcmp(gpio_name, "RESET") == 0)
		gpio = fdt_get_gpio_by_name(gpio_name, 1);
	else
		gpio = fdt_get_gpio_by_name(gpio_name, 0);

	if (!gpio)
		return false;

	if (gpio_get_value(gpio) == value) {
		mdelay(10);
		if (gpio_get_value(gpio) == value)
			return true;
		else
			return false;
	} else {
		return false;
	}
}

/**
 * check_button_is_pressed - 检测是否有按键被按下
 *
 * 检测是否有按键被按下，若某个按键被按下一定时间，则启动 httpd。
 */
void check_button_is_pressed(void) {
	int counter = 3;
	char *button_name = NULL;

	// 检测哪个按键被按下
    if (button_is_pressed("reset_key", RESET_BUTTON_IS_PRESSED))
        button_name = "RESET";
    else if (button_is_pressed("wps_key", WPS_BUTTON_IS_PRESSED))
        button_name = "WPS";
    else if (button_is_pressed("screen_key", SCREEN_BUTTON_IS_PRESSED))
        button_name = "SCREEN";

	// 如果任一按键被按下
	while (button_name != NULL) {
		// 重新检测按键状态
        int still_pressed = 0;

        if (strcmp(button_name, "RESET") == 0)
            still_pressed = button_is_pressed("reset_key", RESET_BUTTON_IS_PRESSED);
        else if (strcmp(button_name, "WPS") == 0)
            still_pressed = button_is_pressed("wps_key", WPS_BUTTON_IS_PRESSED);
        else if (strcmp(button_name, "SCREEN") == 0)
            still_pressed = button_is_pressed("screen_key", SCREEN_BUTTON_IS_PRESSED);

        if (!still_pressed) {
			putc('\n');
            break;
		}

		if (counter == 3) {
#if defined(CONFIG_IPQ_ETH_INIT_DEFER)
			puts("Net: ");
			eth_initialize();
#endif
			printf("\n%s button pressed, enter web failsae mode after: %-2d", button_name, counter);
		}

		// LED 闪烁
		led_off("power_led");
		mdelay(500);
		led_on("power_led");
		mdelay(500);

		counter--;

		printf("\b\b%-2d", counter);

		if (counter <= 0) {
			led_off("power_led");
			led_on("blink_led");
			printf("\n");
			run_command("httpd", 0);
			cli_loop();
			break;
		}
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

/**
 * check_failsafe_env_exists - 检测 failsafe 环境变量是否存在
 *
 * 若 failsafe 环境变量存在，则删除该环境变量，然后启动 httpd。
 */
void check_failsafe_env_exists(void)
{
	if (getenv("failsafe") == NULL)
		return;

	setenv("failsafe", NULL);
	saveenv();

#if defined(CONFIG_IPQ_ETH_INIT_DEFER)
	puts("Net: ");
	eth_initialize();
	/* Wait 3s for link to settle down */
	for (int i = 3; i > 0; i--) {
		led_off("power_led");
		mdelay(500);
		led_on("power_led");
		mdelay(500);
	}
#endif

	led_off("power_led");
	led_on("blink_led");

	printf("\n\"failsafe\" env variable detected, enter web failsae mode\n");
	run_command("httpd", 0);
	cli_loop();

	return;
}

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
