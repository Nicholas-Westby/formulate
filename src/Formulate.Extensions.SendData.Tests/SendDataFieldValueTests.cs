using Formulate.Core.Forms;
using System.Globalization;
using Formulate.Extensions.SendData.Tests.TestSupport;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// How the fields Formulate 3 had (Date, reCAPTCHA) are written into the data Send Data sends.
/// </summary>
public sealed class SendDataFieldValueTests
{
    private readonly PersistedFormField _date = Field("Start date", DateKind, "start");

    private readonly PersistedFormField _text = Field("Reference", TextKind, "ref");

    private readonly PersistedFormField _robot = Field("Robot check", RecaptchaKind, "robot");

    private static async Task SendInCultureAsync(string culture, SendDataTestServices services, object config, FormSubmissionRequest submission)
    {
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);

        try
        {
            await services.SendAsync(config, submission);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    private object Config(params PersistedFormField[] mapped) => new
    {
        url = "http://hook.test/in",
        method = "POST",
        transmissionFormat = "Form Body",
        fields = mapped.Select(x => new { id = x.Id.ToString("N"), name = x.Alias }).ToArray(),
    };

    [Fact]
    public async Task Date_fields_are_sent_as_long_dates_in_the_current_culture_as_in_formulate_3()
    {
        var submission = Submit(Form(_date, _text)).Value(_date, "2026-11-05").Value(_text, "2026-11-05").Build();
        await using var services = SendDataTestServices.Create();

        await SendInCultureAsync("en-US", services, Config(_date, _text), submission);

        // Only Date fields are reformatted.
        Assert.Equal("start=November+05%2C+2026&ref=2026-11-05", services.Network.Single.Body);
    }

    [Fact]
    public async Task Date_fields_are_sent_in_the_culture_of_the_submission()
    {
        var submission = Submit(Form(_date)).Value(_date, "2026-11-05").Build();
        await using var services = SendDataTestServices.Create();

        await SendInCultureAsync("fr-FR", services, Config(_date), submission);

        Assert.Equal("start=novembre+05%2C+2026", services.Network.Single.Body);
    }

    [Fact]
    public async Task A_value_that_is_not_a_date_is_sent_as_it_was()
    {
        var submission = Submit(Form(_date)).Value(_date, "soon").Build();
        await using var services = SendDataTestServices.Create();

        await SendInCultureAsync("en-US", services, Config(_date), submission);

        Assert.Equal("start=soon", services.Network.Single.Body);
    }

    [Fact]
    public async Task The_recaptcha_token_is_sent_only_when_a_site_maps_it()
    {
        var submission = Submit(Form(_text, _robot)).Value(_text, "abc").Value(_robot, "03AGdBq-TOKEN").Build();
        await using var unmapped = SendDataTestServices.Create();
        await using var mapped = SendDataTestServices.Create();

        await unmapped.SendAsync(Config(_text), submission);
        await mapped.SendAsync(Config(_text, _robot), submission);

        Assert.Equal("ref=abc", unmapped.Network.Single.Body);
        Assert.Equal("ref=abc&robot=03AGdBq-TOKEN", mapped.Network.Single.Body);
    }
}
