import React, { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import compareVersions from "compare-versions";
import { toast } from "react-toastify";
import { shell } from "electron";
export function useCheckForNewVersion() {
  useEffect(() => {
    const octokit = new Octokit();
    octokit.repos
      .getLatestRelease({ owner: "bloombooks", repo: "bloompub-viewer" })
      .then((data) => {
        //strip out the leading "v" in "v1.2.3";
        const version = data.data.tag_name.replace(/v/gi, "");

        if (
          compareVersions(version, require("../../package.json").version) > 0
        ) {
          toast.success(
            `Click to get new version of BloomPub Viewer (${data.data.name})`,
            {
              position: "bottom-right",
              autoClose: 15000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              onClick: () => {
                shell.openExternal(data.data.html_url);
              },
            }
          );
        }
      });
  }, []);
}
