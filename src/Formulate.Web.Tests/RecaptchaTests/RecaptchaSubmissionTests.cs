using Formulate.Core.Configuration;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Recaptcha;
using Formulate.Core.FormFields.Text;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities.Submissions;
using Formulate.Core.Validations;
using Formulate.Web.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using Moq;
using Xunit;

namespace Formulate.Web.Tests.RecaptchaTests;

/// <summary>
/// A token posted through AttemptSubmitForm with the real validation, verification, field factory and
/// reCAPTCHA definition, and a fake verifier in place of Google.
/// </summary>
public sealed class RecaptchaSubmissionTests
{
    private readonly PersistedFormField _text = new() { Id = Guid.NewGuid(), KindId = Guid.Parse(TextFieldDefinition.Constants.KindId), Name = "Name" };

    private readonly PersistedFormField _robot = new() { Id = Guid.NewGuid(), KindId = Guid.Parse(RecaptchaFieldDefinition.Constants.KindId), Name = "Robot check" };

    private readonly Mock<IRecaptchaVerifier> _verifier = new();

    private readonly Mock<ISubmitFormSubmissionRequest> _submitter = new();

    private FormSubmissionRequest? _submitted;

    private Task<AttemptSubmitFormOutput> Submit(string name, string? token)
    {
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { _text, _robot } };
        var forms = new Mock<IFormEntityRepository>();
        forms.Setup(x => x.Get(form.Id)).Returns(form);
        _submitter
            .Setup(x => x.SubmitAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<FormSubmissionRequest, CancellationToken>((request, _) => _submitted = request)
            .ReturnsAsync(new SubmitFormSubmissionResult { IsSuccessful = true });

        var definitions = new FormFieldDefinitionCollection(() => new IFormFieldDefinition[]
        {
            new TextFieldDefinition(),
            new RecaptchaFieldDefinition(
                Options.Create(new FormulateRecaptchaOptions { SiteKey = "site", SecretKey = "the-secret" }), _verifier.Object, NullLogger<RecaptchaFieldDefinition>.Instance),
        });
        var fields = new FormFieldFactory(definitions, Mock.Of<IValidationFactory>(), Mock.Of<IValidationEntityRepository>(), NullLogger<FormFieldFactory>.Instance);
        var submit = new AttemptSubmitForm(
            forms.Object, definitions, new BuildFormSubmissionFields(fields), new ValidateFormSubmissionRequest(), new VerifyFormSubmissionRequest(), _submitter.Object,
            Options.Create(new FormulateSubmissionsOptions()), NullLogger<AttemptSubmitForm>.Instance);

        var posted = new Dictionary<string, StringValues> { [_text.Id.ToString("N")] = name };

        if (token is not null)
        {
            posted[_robot.Id.ToString("N")] = token;
        }

        return submit.SubmitAsync(new AttemptSubmitFormInput(form.Id, null, new FormCollection(posted), new FormFileCollection()), CancellationToken.None);
    }

    [Fact]
    public async Task A_token_google_accepts_lets_the_submission_through()
    {
        _verifier
            .Setup(x => x.VerifyAsync("the-secret", "the-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RecaptchaVerification(true, Array.Empty<string>()));

        var output = await Submit("Ada", "the-token");

        Assert.True(output.IsSuccessful);
        Assert.NotNull(_submitted);
        _verifier.Verify(x => x.VerifyAsync("the-secret", "the-token", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_token_google_rejects_fails_the_robot_field_and_runs_no_handler()
    {
        _verifier
            .Setup(x => x.VerifyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RecaptchaVerification(false, new[] { "timeout-or-duplicate" }));

        var output = await Submit("Ada", "the-token");

        Assert.False(output.IsSuccessful);
        var error = Assert.Single(output.Errors);
        Assert.Equal(_robot.Id, error.FieldId);
        Assert.Equal(new[] { RecaptchaField.FailedMessage }, error.Messages);
        Assert.Null(_submitted);
    }

    [Fact]
    public async Task A_missing_token_fails_without_calling_google()
    {
        var output = await Submit("Ada", null);

        Assert.Equal(new[] { RecaptchaField.MissingTokenMessage }, Assert.Single(output.Errors).Messages);
        _verifier.Verify(x => x.VerifyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task The_token_is_not_part_of_the_submission_a_handler_can_store_by_default_but_is_there_for_send_data()
    {
        _verifier
            .Setup(x => x.VerifyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RecaptchaVerification(true, Array.Empty<string>()));

        await Submit("Ada", "the-token");

        // Store Data and the emails skip it by the definition's IsStored; Send Data can map it.
        Assert.Equal("the-token", _submitted!.FieldValues[_robot.Id].GetValues().ToString());
        Assert.False(new RecaptchaFieldDefinition(Options.Create(new FormulateRecaptchaOptions()), _verifier.Object, NullLogger<RecaptchaFieldDefinition>.Instance).IsStored);
    }
}
