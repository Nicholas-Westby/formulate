using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Notifications;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.FormHandlers;
using Microsoft.Extensions.Options;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class UploadSizeNotificationHandlerTests
{
    private static readonly Guid UploadKind = Guid.Parse(UploadFieldDefinition.Constants.KindId);
    private static readonly Guid StoreDataKind = Guid.Parse(StoreDataFormHandlerDefinition.Constants.KindId);

    [Fact]
    public void An_oversized_upload_cancels_the_submission_naming_the_field_and_the_limit()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 2048, handlerKind: StoreDataKind);

        Handler(maxBytes: 1024).Handle(notification);

        Assert.True(notification.Cancel);
        Assert.Contains("Resume", notification.CancelMessage);
        Assert.Contains("1 KB", notification.CancelMessage);
    }

    [Fact]
    public void The_default_limit_is_described_in_megabytes()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: StoreDataSettings.DefaultMaxUploadBytes + 1, handlerKind: StoreDataKind);

        Handler(StoreDataSettings.DefaultMaxUploadBytes).Handle(notification);

        Assert.True(notification.Cancel);
        Assert.Contains("10 MB", notification.CancelMessage);
    }

    [Fact]
    public void A_file_at_the_limit_is_accepted()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 1024, handlerKind: StoreDataKind);

        Handler(maxBytes: 1024).Handle(notification);

        Assert.False(notification.Cancel);
    }

    [Fact]
    public void A_form_without_a_store_data_handler_is_left_alone()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 2048, handlerKind: Guid.NewGuid());

        Handler(maxBytes: 1024).Handle(notification);

        Assert.False(notification.Cancel);
    }

    [Fact]
    public void A_disabled_store_data_handler_does_not_count()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 2048, handlerKind: StoreDataKind, handlerEnabled: false);

        Handler(maxBytes: 1024).Handle(notification);

        Assert.False(notification.Cancel);
    }

    [Fact]
    public void A_file_for_a_field_that_is_not_an_upload_is_left_to_the_store()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Other" };
        var notification = Notification(field, bytes: 2048, handlerKind: StoreDataKind);

        Handler(maxBytes: 1024).Handle(notification);

        Assert.False(notification.Cancel);
    }

    [Fact]
    public void An_earlier_cancellation_keeps_its_message()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 2048, handlerKind: StoreDataKind);
        notification.CancelSubmission("Closed.");

        Handler(maxBytes: 1024).Handle(notification);

        Assert.Equal("Closed.", notification.CancelMessage);
    }

    [Fact]
    public void A_form_without_a_field_list_is_left_alone()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Resume" };
        var notification = Notification(field, bytes: 2048, handlerKind: StoreDataKind);
        notification.Request.Form.Fields = null!;

        Handler(maxBytes: 1024).Handle(notification);

        Assert.False(notification.Cancel);
    }

    private static UploadSizeNotificationHandler Handler(long maxBytes) =>
        new(Options.Create(new StoreDataSettings { MaxUploadBytes = maxBytes }));

    private static FormSubmittingNotification Notification(
        PersistedFormField field, long bytes, Guid handlerKind, bool handlerEnabled = true)
    {
        var form = new PersistedForm
        {
            Id = Guid.NewGuid(),
            Fields = new[] { field },
            Handlers = new[] { new PersistedFormHandler { Id = Guid.NewGuid(), KindId = handlerKind, Enabled = handlerEnabled } }
        };
        var file = new FormFileValue { Name = "big.bin", Data = new byte[bytes], ContentType = "application/octet-stream" };
        var request = new FormSubmissionRequest(
            form, 1,
            new Dictionary<Guid, IStringFormFieldValues>(),
            new Dictionary<Guid, IFileFormFieldValues> { [field.Id] = new FilesFormFieldValues(new[] { file }) });

        return new FormSubmittingNotification(request);
    }
}
