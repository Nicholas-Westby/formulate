namespace Formulate.Extensions.SendEmail
{
    using Formulate.Extensions.SendEmail.Utilities;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// Registers the services the email handlers resolve for each submission.
    /// </summary>
    internal static class SendEmailServiceCollectionExtensions
    {
        /// <summary>
        /// Reads <see cref="EmailSettings"/> from the "Formulate:Email" section.
        /// </summary>
        /// <remarks>
        /// Formulate:Email:Whitelist may be an array or one value, such as the environment variable
        /// Formulate__Email__Whitelist=example.com;sales@other.com. The configuration binder fills an array
        /// only from numbered entries (Whitelist:0, Whitelist:1) and ignores a single value, which would leave
        /// the whitelist unset and so allow every address. A single value, when there is one, is used instead,
        /// even an empty one: the setting is then there with no entries, which allows no typed address.
        /// </remarks>
        public static IServiceCollection AddFormulateEmailSettings(this IServiceCollection services, IConfiguration configuration)
        {
            var section = configuration.GetSection(EmailSettings.SectionName);
            services.Configure<EmailSettings>(section);
            services.PostConfigure<EmailSettings>(settings =>
            {
                // Null when the setting is an array (Whitelist:0 and so on), is JSON null, or is not there.
                var single = section[nameof(EmailSettings.Whitelist)];

                if (single is not null)
                {
                    settings.Whitelist = new[] { single };
                }
            });

            return services;
        }

        public static IServiceCollection AddFormulateSendEmail(this IServiceCollection services)
        {
            services.AddScoped<ISubmissionPageResolver, SubmissionPageResolver>();
            services.AddScoped<EmailRecipientResolver>();
            services.AddScoped<EmailDispatcher>();
            services.AddScoped<SendEmailContentBuilder>();
            services.AddScoped<SendEmailWorker>();

            return services;
        }
    }
}
