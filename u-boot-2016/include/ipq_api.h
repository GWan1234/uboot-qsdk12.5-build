#define RESET_BUTTON_IS_PRESSED        0
#define WPS_BUTTON_IS_PRESSED          0
#define SCREEN_BUTTON_IS_PRESSED       0

typedef struct {
	bool spi;
	bool nand;
	bool mmc;
} detected_flash_device_t;

extern detected_flash_device_t detected_flash_device;

/* loadaddr 环境变量的默认值 (u-boot-2016/include/env_default.h) */
#if defined(CONFIG_IPQ40XX)
#define CONFIG_LOADADDR 0x84000000
#else
#define CONFIG_LOADADDR 0x44000000
#endif

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
void detect_flash_device(void);
void led_on(const char *gpio_name);
void led_off(const char *gpio_name);
void led_toggle(const char *gpio_name);
unsigned int fdt_get_gpio_by_name(const char *gpio_name, const int debug_state);
size_t json_escape(const char *input, char *output, size_t output_buffer_size);
bool mmc_part_exists(const char *part_name);

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
