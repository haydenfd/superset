import { describe, expect, mock, test } from "bun:test";
import type { ExternalApp } from "@superset/local-db";
import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let availableApps: ExternalApp[] | null = null;

mock.module("renderer/lib/electron-trpc", () => ({
	electronTrpc: {
		external: {
			availableApps: {
				useQuery: () => ({ data: availableApps }),
			},
		},
	},
}));

const menuComponent = (name: string) =>
	function MenuComponent({ children }: PropsWithChildren) {
		return createElement("div", { "data-menu-component": name }, children);
	};

mock.module("@superset/ui/dropdown-menu", () => ({
	DropdownMenuItem: menuComponent("item"),
	DropdownMenuSeparator: menuComponent("separator"),
	DropdownMenuSub: menuComponent("sub"),
	DropdownMenuSubContent: menuComponent("sub-content"),
	DropdownMenuSubTrigger: menuComponent("sub-trigger"),
}));

const { OpenInExternalDropdownItems } = await import(
	"./OpenInExternalDropdownItems"
);

function renderItems(apps: ExternalApp[] | null): string {
	availableApps = apps;
	return renderToStaticMarkup(
		<OpenInExternalDropdownItems
			isDark={false}
			onOpenIn={() => {}}
			onCopyPath={() => {}}
		/>,
	);
}

describe("OpenInExternalDropdownItems", () => {
	test("renders only detected apps and removes empty nested groups", () => {
		const markup = renderItems(["finder", "zed", "ghostty"]);

		expect(markup).toContain("Finder");
		expect(markup).toContain("Zed");
		expect(markup).toContain("Ghostty");
		expect(markup).toContain("IDE");
		expect(markup).toContain("Terminal");
		expect(markup).not.toContain("VS Code");
		expect(markup).not.toContain("JetBrains");
		expect(markup).not.toContain("Cursor");
	});

	test("keeps Finder and the top-level submenus with no detected apps", () => {
		const markup = renderItems([]);

		expect(markup).toContain("Finder");
		expect(markup).toContain("IDE");
		expect(markup).toContain("Terminal");
		expect(markup).not.toContain("VS Code");
		expect(markup).not.toContain("JetBrains");
	});

	test("preserves the unfiltered menu after a null fallback", () => {
		const markup = renderItems(null);

		expect(markup).toContain("Cursor");
		expect(markup).toContain("VS Code");
		expect(markup).toContain("JetBrains");
		expect(markup).toContain("iTerm");
	});
});
