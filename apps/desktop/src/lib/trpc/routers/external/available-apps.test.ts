import { describe, expect, spyOn, test } from "bun:test";
import {
	createExternalAppAvailabilityCache,
	detectAvailableExternalApps,
	MACOS_AVAILABILITY_SCRIPT,
	type MacOSAppDescriptor,
} from "./available-apps";

describe("detectAvailableExternalApps", () => {
	test("uses one batched macOS script call", async () => {
		let calls = 0;
		let descriptors: readonly MacOSAppDescriptor[] = [];
		const result = await detectAvailableExternalApps(
			"darwin",
			async (input) => {
				calls++;
				descriptors = input;
				return JSON.stringify(["zed", "intellij", "pycharm"]);
			},
		);

		expect(calls).toBe(1);
		expect(descriptors.length).toBeGreaterThan(1);
		expect(result).toEqual(["finder", "zed", "intellij", "pycharm"]);
	});

	test("always includes Finder and removes duplicate results", async () => {
		expect(
			await detectAvailableExternalApps(
				"darwin",
				async () => '["finder","finder","cursor","cursor"]',
			),
		).toEqual(["finder", "cursor"]);
	});

	test("rejects malformed and unknown script output", async () => {
		await expect(
			detectAvailableExternalApps("darwin", async () => '"cursor"'),
		).rejects.toThrow("Invalid macOS external-app availability response");
		await expect(
			detectAvailableExternalApps("darwin", async () => '["unknown"]'),
		).rejects.toThrow("Invalid macOS external-app availability response");
	});

	test("does not run detection on unsupported platforms", async () => {
		let calls = 0;
		const result = await detectAvailableExternalApps("linux", async () => {
			calls++;
			return "[]";
		});

		expect(result).toBeNull();
		expect(calls).toBe(0);
	});

	test("unwraps Objective-C nil results", () => {
		expect(MACOS_AVAILABILITY_SCRIPT).toContain("ObjC.unwrap(raw)");
		expect(MACOS_AVAILABILITY_SCRIPT).toContain("value !== undefined");
		expect(MACOS_AVAILABILITY_SCRIPT).toContain("value !== null");
	});
});

describe("createExternalAppAvailabilityCache", () => {
	test("eager start and concurrent reads share one promise", async () => {
		let calls = 0;
		const cache = createExternalAppAvailabilityCache(async () => {
			calls++;
			return ["finder", "cursor"];
		});

		const eager = cache();
		const read = cache();
		expect(read).toBe(eager);
		expect(cache()).toBe(eager);
		expect(await read).toEqual(["finder", "cursor"]);
		expect(calls).toBe(1);
	});

	test("returns null and warns once when detection fails", async () => {
		const warning = spyOn(console, "warn").mockImplementation(() => {});
		const cache = createExternalAppAvailabilityCache(async () => {
			throw new Error("osascript failed");
		});

		expect(await cache()).toBeNull();
		expect(await cache()).toBeNull();
		expect(warning).toHaveBeenCalledTimes(1);
		warning.mockRestore();
	});
});
