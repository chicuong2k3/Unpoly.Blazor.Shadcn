namespace Unpoly.Blazor.Shadcn.Maui;

public partial class App : Application
{
	public App()
	{
		InitializeComponent();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		return new Window(new MainPage()) { Title = "Unpoly.Blazor.Shadcn.Maui" };
	}
}
