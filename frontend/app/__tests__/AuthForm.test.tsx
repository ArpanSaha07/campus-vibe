import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthForm from "@/app/components/auth-components/AuthForm";

const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockPush = jest.fn();

jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("AuthForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("logs in with email and password, then redirects home", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<AuthForm />);

    await userEvent.type(screen.getByPlaceholderText("Email"), "a@campus.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(mockLogin).toHaveBeenCalledWith("a@campus.com", "password123");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("switches to register mode and submits name, email, password", async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    render(<AuthForm />);

    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await userEvent.type(screen.getByPlaceholderText("Full name"), "New Student");
    await userEvent.type(screen.getByPlaceholderText("Email"), "new@campus.com");
    await userEvent.type(
      screen.getByPlaceholderText("Password (min 8 characters)"),
      "password123"
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(mockRegister).toHaveBeenCalledWith("New Student", "new@campus.com", "password123");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows the backend error message on failure and does not redirect", async () => {
    mockLogin.mockRejectedValueOnce(
      new Error(JSON.stringify({ message: "Invalid credentials" }))
    );
    render(<AuthForm />);

    await userEvent.type(screen.getByPlaceholderText("Email"), "a@campus.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
