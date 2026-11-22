using System.Net;
using System.Net.Sockets;
using Formulate.Core.FormHandlers;
using Formulate.Extensions.SendData.Tests.TestSupport;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// A request that fails is logged, and never fails the visitor's submission or stops the other handlers.
/// </summary>
public sealed class SendDataFailureTests
{
    private static readonly object Config = new { url = "http://hook.test/in?key=secret", method = "POST", transmissionFormat = "JSON" };

    [Fact]
    public async Task Non_success_status_is_logged_not_thrown()
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Status = HttpStatusCode.InternalServerError;
        services.Network.ResponseBody = "boom";
        var field = Field("Name", TextKind, "name");

        await services.SendAsync(Config, Submit(TestForms.Form(field)).Value(field, "Ann").Build());

        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains("500", error.Message);
        Assert.Contains("http://hook.test/in", error.Message);
        Assert.Contains("Send to the CRM", error.Message);
        Assert.Contains("Contact Us", error.Message);

        // The query string can hold a key, so it is not logged.
        Assert.DoesNotContain("secret", error.Message);
    }

    [Fact]
    public async Task Timeout_is_logged_and_the_submission_still_succeeds()
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Failure = new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout of 30 seconds elapsing.", new TimeoutException());
        var recorder = new RecordingDefinition();

        var result = await RunAsync(services, recorder);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains("http://hook.test/in", error.Message);
        Assert.Contains("timed out", error.Message);
    }

    [Fact]
    public async Task Connection_failure_is_logged_and_the_submission_still_succeeds()
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Failure = new HttpRequestException("refused", new SocketException((int)SocketError.ConnectionRefused));
        var recorder = new RecordingDefinition();

        var result = await RunAsync(services, recorder);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains("http://hook.test/in", error.Message);
        Assert.IsType<HttpRequestException>(error.Exception);
    }

    [Fact]
    public async Task Server_error_through_the_runner_still_succeeds()
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Status = HttpStatusCode.BadGateway;
        var recorder = new RecordingDefinition();

        var result = await RunAsync(services, recorder);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Contains("502", Assert.Single(services.Logs.Errors).Message);
    }

    private static async Task<Formulate.Core.Utilities.Submissions.SubmitFormSubmissionResult> RunAsync(SendDataTestServices services, RecordingDefinition recorder)
    {
        var field = Field("Name", TextKind, "name");
        var send = SendDataTestServices.Settings(services.Definition, SendDataTestServices.ToJson(Config));
        var form = TestForms.Form(field);
        form.Handlers = new[] { send, SendDataTestServices.Settings(recorder, null) };

        return await services.Runner(recorder).SubmitAsync(Submit(form).Value(field, "Ann").Build(), TestContext.Current.CancellationToken);
    }
}
