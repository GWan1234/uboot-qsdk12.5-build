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

#define CONFIG_LOADADDR 0x44000000

void check_button_is_pressed(void);
void led_on(const char *gpio_name);
void led_off(const char *gpio_name);
void led_toggle(const char *gpio_name);
unsigned int fdt_get_gpio_by_name(const char *gpio_name, const int debug_state);
