#!/bin/bash

case "$1" in
    remove|purge)

        # Delete the link to the binary
        # update-alternatives --remove <name> <path>: 'path' must be the registered alternative binary,
        # not the generic symlink — see https://man7.org/linux/man-pages/man1/update-alternatives.1.html
        if type update-alternatives >/dev/null 2>&1; then
            update-alternatives --remove 'bloompub-viewer' '/opt/BloomPUBViewer/bloompub-viewer' || true
        else
            rm -f '/usr/bin/bloompub-viewer'
        fi

        APPARMOR_PROFILE_DEST='/etc/apparmor.d/bloompub-viewer'

        # Remove and unload apparmor profile.
        if [ -f "$APPARMOR_PROFILE_DEST" ]; then
            # Unload the profile from the running kernel before deleting the file so the
            # policy is not left enforced until the next reboot.  Mirror the chroot guard
            # used in the after-install script — live AppArmor operations are not
            # meaningful inside a chroot.
            # https://wiki.debian.org/AppArmor/HowToUse
            if apparmor_status --enabled > /dev/null 2>&1; then
                if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
                    apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
                fi
            fi
            rm -f "$APPARMOR_PROFILE_DEST"
        fi

        # delete the renamed destination folder (remember, AppArmor can't handle spaces in the pathname)
        rm -rf /opt/BloomPUBViewer
        rm -f "/opt/BloomPUB Viewer" # just to be safe

    ;;
esac
