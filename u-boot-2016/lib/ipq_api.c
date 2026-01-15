#include <common.h>
#include <cli.h>
#include <ipq_api.h>
#include <asm/gpio.h>
#include <fdtdec.h>
#include <part.h>
#include <mmc.h>
#include <sdhci.h>
#include <cmd_untar.h>
#include <asm/arch-qca-common/smem.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <ubi_uboot.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

unsigned int fdt_get_gpio_by_name(const char *gpio_name) {
	int node;
	unsigned int gpio;

	node = fdt_path_offset(gd->fdt_blob, gpio_name);
	if (node < 0) {
		printf("Could not find %s node in fdt\n", gpio_name);
		return 0;
	}

	gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
	if (!gpio) {
		printf("Could not find %s node's gpio in fdt\n", gpio_name);
		return 0;
	}

	return gpio;
}

void led_toggle(const char *gpio_name) {
	int value;
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name);
	if (!gpio)
		return;

	value = gpio_get_value(gpio);
	value = !value;
	gpio_set_value(gpio, value);

	return;
}

void led_on(const char *gpio_name) {
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name);
	if (!gpio)
		return;

	gpio_set_value(gpio, 1);

	return;
}

void led_off(const char *gpio_name) {
	unsigned int gpio;

	gpio = fdt_get_gpio_by_name(gpio_name);
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

	gpio = fdt_get_gpio_by_name(gpio_name);
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
	int counter = 5;
	char *button_name = NULL;

	// 检测哪个按键被按下
    if (button_is_pressed("reset_key", RESET_BUTTON_IS_PRESSED)) {
        button_name = "RESET";
    }
#if defined(HAS_WPS_KEY)
	else if (button_is_pressed("wps_key", WPS_BUTTON_IS_PRESSED)) {
        button_name = "WPS";
    }
#endif
#if defined(HAS_SCREEN_KEY)
	else if (button_is_pressed("screen_key", SCREEN_BUTTON_IS_PRESSED)) {
        button_name = "SCREEN";
    }
#endif

	// 如果任一按键被按下
	while (button_name != NULL) {
		// 重新检测按键状态
        int still_pressed = 0;

        if (strcmp(button_name, "RESET") == 0) {
            still_pressed = button_is_pressed("reset_key", RESET_BUTTON_IS_PRESSED);
        }
#if defined(HAS_WPS_KEY)
		else if (strcmp(button_name, "WPS") == 0) {
            still_pressed = button_is_pressed("wps_key", WPS_BUTTON_IS_PRESSED);
        }
#endif
#if defined(HAS_SCREEN_KEY)
		else if (strcmp(button_name, "SCREEN") == 0) {
            still_pressed = button_is_pressed("screen_key", SCREEN_BUTTON_IS_PRESSED);
        }
#endif

        if (!still_pressed)
            break;  // 按键已释放

		if (counter == 5) {
#if defined(CONFIG_IPQ_ETH_INIT_DEFER)
			puts("Net: ");
			eth_initialize();
#endif
			printf("\n%s button pressed, enter web failsae mode after: %-2d", button_name, counter);
		}

		// LED 闪烁
		led_off("power_led");
		mdelay(350);
		led_on("power_led");
		mdelay(350);

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

	if (counter > 0)
		printf("\n");

	return;
}
