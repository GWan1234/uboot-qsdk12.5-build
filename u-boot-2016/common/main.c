/*
 * (C) Copyright 2000
 * Wolfgang Denk, DENX Software Engineering, wd@denx.de.
 *
 * SPDX-License-Identifier:	GPL-2.0+
 */

/* #define	DEBUG	*/

#include <common.h>
#include <autoboot.h>
#include <cli.h>
#include <console.h>
#include <version.h>
#include <net.h>
#if defined(CONFIG_HTTPD)
#include <asm/arch-qca-common/gpio.h>
#include <ipq_api.h>
#endif

DECLARE_GLOBAL_DATA_PTR;

/*
 * Board-specific Platform code can reimplement show_boot_progress () if needed
 */
__weak void show_boot_progress(int val) {}

#ifndef CONFIG_REDUCE_FOOTPRINT
static void modem_init(void)
{
#ifdef CONFIG_MODEM_SUPPORT
	debug("DEBUG: main_loop:   gd->do_mdm_init=%lu\n", gd->do_mdm_init);
	if (gd->do_mdm_init) {
		char *str = getenv("mdm_cmd");

		setenv("preboot", str);  /* set or delete definition */
		mdm_init(); /* wait for modem connection */
	}
#endif  /* CONFIG_MODEM_SUPPORT */
}

static void run_preboot_environment_command(void)
{
#ifdef CONFIG_PREBOOT
	char *p;

	p = getenv("preboot");
	if (p != NULL) {
# ifdef CONFIG_AUTOBOOT_KEYED
		int prev = disable_ctrlc(1);	/* disable Control C checking */
# endif

		run_command_list(p, -1, 0);

# ifdef CONFIG_AUTOBOOT_KEYED
		disable_ctrlc(prev);	/* restore Control C checking */
# endif
	}
#endif /* CONFIG_PREBOOT */
}
#endif

/* We come here after U-Boot is initialised and ready to process commands */
void main_loop(void)
{
	const char *s = NULL;

	bootstage_mark_name(BOOTSTAGE_ID_MAIN_LOOP, "main_loop");

#ifndef CONFIG_SYS_GENERIC_BOARD
	puts("Warning: Your board does not use generic board. Please read\n");
	puts("doc/README.generic-board and take action. Boards not\n");
	puts("upgraded by the late 2014 may break or be removed.\n");
#endif

#ifndef CONFIG_REDUCE_FOOTPRINT
	modem_init();
#ifdef CONFIG_VERSION_VARIABLE
	setenv("ver", version_string);  /* set version variable */
#endif /* CONFIG_VERSION_VARIABLE */
#endif

	cli_init();

#ifndef CONFIG_REDUCE_FOOTPRINT
	run_preboot_environment_command();
#endif

#if defined(CONFIG_UPDATE_TFTP)
	update_tftp(0UL, NULL, NULL);
#endif /* CONFIG_UPDATE_TFTP */

#if defined(CONFIG_FORCE_NETWORK_ENV)
	if (getenv("custom_network") == NULL) {
# if defined(CONFIG_IPADDR)
		char *default_ipaddr = __stringify(CONFIG_IPADDR);
# else
		char *default_ipaddr = "192.168.1.1";
# endif /* CONFIG_IPADDR */
# if defined(CONFIG_NETMASK)
		char *default_netmask = __stringify(CONFIG_NETMASK);
# else
		char *default_netmask = "255.255.255.0";
# endif /* CONFIG_NETMASK */
# if defined(CONFIG_SERVERIP)
		char *default_serverip = __stringify(CONFIG_SERVERIP);
# else
		char *default_serverip = "192.168.1.2";
# endif /* CONFIG_SERVERIP */

		int changed = 0;

		if (strcmp(getenv("ipaddr"), default_ipaddr)) {
			setenv("ipaddr", default_ipaddr);
			net_ip = string_to_ip(default_ipaddr);
			changed = 1;
		}

		if (strcmp(getenv("netmask"), default_netmask)) {
			setenv("netmask", default_netmask);
			net_netmask = string_to_ip(default_netmask);
			changed = 1;
		}

		if (strcmp(getenv("serverip"), default_serverip)) {
			setenv("serverip", default_serverip);
			net_server_ip = string_to_ip(default_serverip);
			changed = 1;
		}

		if (changed) {
			printf("\"custom_network\" env variable not defined, "
				"reset network settings to default values:\n");
			printf("    ipaddr: %s\n", default_ipaddr);
			printf("    netmask: %s\n", default_netmask);
			printf("    serverip: %s\n", default_serverip);
			saveenv();
		}
	}
#endif /* CONFIG_FORCE_NETWORK_ENV */

#if defined(CONFIG_HTTPD)
	if (getenv("failsafe") != NULL) {
		setenv("failsafe", NULL);
		saveenv();
		led_off("power_led");
#if defined(CONFIG_IPQ_ETH_INIT_DEFER)
		puts("Net: ");
		eth_initialize();
#endif
		led_on("blink_led");
		printf("\n\"failsafe\" env variable detected, enter web failsae mode\n");
		run_command("httpd", 0);
	}
	check_button_is_pressed();
#endif

	s = bootdelay_process();
#ifndef CONFIG_REDUCE_FOOTPRINT
	if (cli_process_fdt(&s))
		cli_secure_boot_cmd(s);
#endif

	autoboot_command(s);

	cli_loop();
}
