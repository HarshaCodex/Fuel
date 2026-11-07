import { render, screen } from "@testing-library/react-native";
import { PixelRatio } from "react-native";

import type { DashboardEntry } from "@/api/tracking";
import { lightColors } from "@/theme";

import { MealList } from "./MealList";
import { MealRow } from "./MealRow";
import { TrustBadge } from "./TrustBadge";

afterEach(() => jest.restoreAllMocks());

const at = new Date(2026, 10, 3, 12, 30).toISOString();
const entry = (
  id: string,
  mealLabel: string | null,
  over: Partial<DashboardEntry> = {},
): DashboardEntry => ({
  id,
  foodName: "Chicken breast",
  source: "USDA",
  mealLabel,
  calories: 248,
  protein: 46,
  carbs: 0,
  fat: 5,
  loggedAt: at,
  ...over,
});
const rowProps = {
  name: "Chicken breast",
  source: "USDA",
  loggedAt: at,
  calories: 248,
  protein: 46,
  carbs: 0,
  fat: 5,
} as const;

describe("TrustBadge", () => {
  it.each([
    ["USDA", "USDA Verified", lightColors.successSoft],
    ["OFF", "Manufacturer Label", lightColors.infoSoft],
    ["USER", "You Entered", lightColors.accentSoft],
  ] as const)("shows the %s label", async (source, text, bg) => {
    await render(<TrustBadge source={source} />);
    const label = screen.getByText(text);
    expect(label).toBeTruthy();
    expect(label.props.maxFontSizeMultiplier).toBe(1.3);
    expect(label.parent).toHaveStyle({ backgroundColor: bg });
  });
});

describe("MealRow", () => {
  it("is one element with a spoken label", async () => {
    await render(<MealRow {...rowProps} mealLabel="lunch" />);
    expect(
      screen.getByLabelText(
        "Chicken breast, lunch, 248 calories, USDA Verified, 12:30 PM",
      ),
    ).toBeTruthy();
    expect(screen.getByText("P 46 - C 0 - F 5")).toBeTruthy();
    expect(screen.getByText("248")).toBeTruthy();
    expect(screen.getByText("kcal")).toBeTruthy();
  });

  it("drops the meal from the label when there is none", async () => {
    await render(<MealRow {...rowProps} mealLabel={null} />);
    expect(
      screen.getByLabelText(
        "Chicken breast, 248 calories, USDA Verified, 12:30 PM",
      ),
    ).toBeTruthy();
  });

  it("allows two name lines at large text sizes", async () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.6);
    await render(<MealRow {...rowProps} mealLabel={null} />);
    expect(screen.getByText("Chicken breast").props.numberOfLines).toBe(2);
  });

  it("keeps one name line at normal text size", async () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);
    await render(<MealRow {...rowProps} mealLabel={null} />);
    expect(screen.getByText("Chicken breast").props.numberOfLines).toBe(1);
  });
});

describe("MealList", () => {
  it("renders nothing when empty", async () => {
    await render(<MealList entries={[]} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("groups under headers with dividers between rows only", async () => {
    await render(
      <MealList
        entries={[
          entry("1", "lunch"),
          entry("2", "lunch", { foodName: "Rice" }),
          entry("3", "breakfast", { foodName: "Eggs" }),
        ]}
      />,
    );
    const headers = screen.getAllByRole("header").map((h) => h.props.children);
    expect(headers).toEqual(["Breakfast", "Lunch"]);
    expect(screen.getAllByTestId("meal-divider")).toHaveLength(1);
    expect(screen.getByLabelText(/^Rice, lunch/)).toBeTruthy();
  });
});
