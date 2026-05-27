import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import StatCard from "../src/components/StatCard.vue";

describe("StatCard", () => {
  it("renders label and value", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Total Requests",
        value: 1234,
        icon: "R",
        iconBg: "bg-blue-100 text-blue-600",
      },
    });

    expect(wrapper.text()).toContain("Total Requests");
    expect(wrapper.text()).toContain("1234");
  });

  it("renders percentage for rate labels", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Cache Hit Rate",
        value: 85.5,
        icon: "H",
        iconBg: "bg-green-100 text-green-600",
      },
    });

    expect(wrapper.text()).toContain("85.5%");
  });

  it("renders string values directly", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Status",
        value: "Active",
        icon: "S",
        iconBg: "bg-blue-100",
      },
    });

    expect(wrapper.text()).toContain("Active");
  });
});
