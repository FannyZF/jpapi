import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppLayout from "../src/components/AppLayout.vue";

describe("AppLayout", () => {
  it("renders navigation links", () => {
    const wrapper = mount(AppLayout, {
      slots: {
        default: "<div>Content</div>",
      },
      global: {
        stubs: {
          "router-link": {
            template: "<a><slot /></a>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Dashboard");
    expect(wrapper.text()).toContain("History");
    expect(wrapper.text()).toContain("Cache Manager");
    expect(wrapper.text()).toContain("Export CSV");
    expect(wrapper.text()).toContain("Content");
  });
});
