namespace Formulate.Extensions.StoreData.FormHandlers
{
    using Formulate.Core.FormFields.Upload;
    using Formulate.Core.Notifications;
    using Microsoft.Extensions.Options;
    using System.Globalization;
    using Umbraco.Cms.Core.Events;

    /// <summary>
    /// Cancels a submission whose uploaded file is larger than <see cref="StoreDataSettings.MaxUploadBytes"/>,
    /// when the form stores its data. Without this the store would drop the file and the visitor would
    /// be told the submission worked.
    /// </summary>
    internal sealed class UploadSizeNotificationHandler : INotificationHandler<FormSubmittingNotification>
    {
        private static readonly Guid UploadKindId = Guid.Parse(UploadFieldDefinition.Constants.KindId);

        private static readonly Guid StoreDataKindId = Guid.Parse(StoreDataFormHandlerDefinition.Constants.KindId);

        private readonly IOptions<StoreDataSettings> _settings;

        public UploadSizeNotificationHandler(IOptions<StoreDataSettings> settings)
        {
            _settings = settings;
        }

        public void Handle(FormSubmittingNotification notification)
        {
            var form = notification.Request.Form;

            if (form?.Handlers is null || form.Fields is null || form.Handlers.Any(x => x.Enabled && x.KindId == StoreDataKindId) == false)
            {
                return;
            }

            var maxBytes = _settings.Value.MaxUploadBytes;

            foreach (var field in form.Fields.Where(x => x.KindId == UploadKindId))
            {
                if (notification.Request.FilesValues.TryGetValue(field.Id, out var values) == false)
                {
                    continue;
                }

                if (values.GetValues().Any(x => (x.Data?.LongLength ?? 0) > maxBytes))
                {
                    notification.CancelSubmission(
                        $"The file for \"{field.Name}\" is too large. Files can be up to {FormatSize(maxBytes)}.");

                    return;
                }
            }
        }

        private static string FormatSize(long bytes)
        {
            const long kilobyte = 1024;
            const long megabyte = kilobyte * 1024;

            if (bytes >= megabyte)
            {
                return string.Create(CultureInfo.InvariantCulture, $"{Math.Round(bytes / (double)megabyte, 1)} MB");
            }

            if (bytes >= kilobyte)
            {
                return string.Create(CultureInfo.InvariantCulture, $"{Math.Round(bytes / (double)kilobyte, 1)} KB");
            }

            return string.Create(CultureInfo.InvariantCulture, $"{bytes} bytes");
        }
    }
}
