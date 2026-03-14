#define RESET_BUTTON_IS_PRESSED        0
#define WPS_BUTTON_IS_PRESSED          0
#define SCREEN_BUTTON_IS_PRESSED       0

/* eMMC 机型*/
#if defined(CONFIG_TARGET_IPQ6018_JDCLOUD_RE_CS_02) || \
    defined(CONFIG_TARGET_IPQ6018_JDCLOUD_RE_CS_07) || \
    defined(CONFIG_TARGET_IPQ6018_JDCLOUD_RE_SS_01) || \
    defined(CONFIG_TARGET_IPQ6018_LINK_NN6000) || \
    defined(CONFIG_TARGET_IPQ6018_REDMI_AX5_JDCLOUD)
#define MACHINE_FLASH_TYPE_EMMC 1
#endif

/* NOR + eMMC 机型*/
#if defined(CONFIG_TARGET_IPQ6018_PHILIPS_LY1800) || \
    defined(CONFIG_TARGET_IPQ6018_SY_Y6010)
#define MACHINE_FLASH_TYPE_NORPLUSEMMC 1
#endif

/* NAND 机型 */
#if defined(CONFIG_TARGET_IPQ6018_CMIOT_AX18) || \
    defined(CONFIG_TARGET_IPQ6018_QIHOO_360V6) || \
    defined(CONFIG_TARGET_IPQ6018_ZN_M2)
#define MACHINE_FLASH_TYPE_NAND 1
#endif

/* loadaddr 环境变量的默认值 (u-boot-2016/include/env_default.h) */
#define CONFIG_LOADADDR CONFIG_SYS_LOAD_ADDR

/*
 * 每次启动都会检查环境变量：ipaddr、netmask 和 serverip，并将其重置为默认值。
 * 若想要自定义这三个环境变量，需添加 custom_network 环境变量（任意合法非空值即可）。
 */
#define CONFIG_FORCE_NETWORK_ENV

#define CONFIG_TFTP_TSIZE
#if defined(CONFIG_TFTP_TSIZE)
/* tftpboot 和 tftpput 显示数字百分比进度（依赖于 CONFIG_TFTP_TSIZE） */
#define CONFIG_TFTP_DIGITAL_PROGRESS
#endif

void check_failsafe_env_exists(void);
void check_button_is_pressed(void);
void led_on(const char *gpio_name);
void led_off(const char *gpio_name);
void led_toggle(const char *gpio_name);
unsigned int fdt_get_gpio_by_name(const char *gpio_name, const int debug_state);
size_t json_escape(const char *input, char *output, size_t output_buffer_size);

static inline void handle_start_led_state(void)
{
	led_off("power_led");
	led_off("system_led");
	led_on("blink_led");
}

static inline void handle_fail_led_state(void)
{
    led_off("blink_led");
	led_off("system_led");
	led_on("power_led");
}

static inline void handle_success_led_state(void)
{
	led_off("blink_led");
    led_off("power_led");
	led_on("system_led");
}
