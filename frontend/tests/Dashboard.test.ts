import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import Dashboard from "../src/views/Dashboard.vue";

vi.mock("../src/api", () => ({
  fetchStatistics: vi.fn().mockResolvedValue({
    data: {
      data: {
        total_requests: 100,
        cache_hit_rate: 75.5,
        by_type: { address: 40, name: 30, item: 10, recipient: 20 },
        by_source: { live: 60, cache: 30, fallback: 10 },
        session: { total: 15, live: 10, cache: 3, fallback: 2, partial: 0 },
      },
    },
  }),
}));

describe("Dashboard", () => {
  it("renders stat cards with data", async () => {
    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          AppLayout: { template: "<div><slot /></div>" },
          StatCard: { template: "<div>{{ label }}: {{ value }}</div>", props: ["label", "value", "icon", "iconBg"] },
          "router-link": { template: "<a><slot /></a>" },
        },
      },
    });

    await new Promise((r) => setTimeout(r, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Total Requests");
    expect(wrapper.text()).toContain("100");
    expect(wrapper.text()).toContain("75.5");
  });
});
