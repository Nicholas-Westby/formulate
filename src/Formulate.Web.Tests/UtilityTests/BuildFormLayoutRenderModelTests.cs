using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormFields.Text;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Utilities.Internal;
using Formulate.Core.Validations;
using Formulate.Web.Tests.PersistenceTests;
using Formulate.Web.Utilities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Formulate.Web.Tests.UtilityTests
{
    public class BuildFormLayoutRenderModelTests
    {
        [Fact]
        public void BuildForm_logs_and_skips_fields_whose_kind_is_not_installed()
        {
            var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid() };
            var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } };
            var forms = new Mock<IFormEntityRepository>();
            forms.Setup(x => x.Get(form.Id)).Returns(form);
            var fieldFactory = new Mock<IFormFieldFactory>();
            fieldFactory.Setup(x => x.Create(field)).Returns((IFormField)null!);
            var logger = new CapturingLogger<BuildFormLayoutRenderModel>();
            var builder = new BuildFormLayoutRenderModel(forms.Object, fieldFactory.Object,
                new FormFieldDefinitionCollection(() => Array.Empty<IFormFieldDefinition>()),
                Mock.Of<ILayoutEntityRepository>(), Mock.Of<ILayoutFactory>(), logger);

            var result = builder.BuildForm(form.Id);

            Assert.Null(result);
            var entry = Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(field.Id.ToString(), entry.Message);
            Assert.Contains(form.Id.ToString(), entry.Message);
        }

        [Fact]
        public void BuildForm_skips_a_field_whose_configuration_was_broken_on_disk_and_keeps_the_others()
        {
            // The real field factory and definitions, as a page that renders the form uses them.
            var json = new JsonUtility(new NewtonsoftJsonSerializer());
            var definitions = new FormFieldDefinitionCollection(() => new IFormFieldDefinition[] { new TextFieldDefinition(), new ButtonFieldDefinition(json) });
            var factoryLogger = new CapturingLogger<FormFieldFactory>();
            var fieldFactory = new FormFieldFactory(definitions, Mock.Of<IValidationFactory>(), Mock.Of<IValidationEntityRepository>(), factoryLogger);
            var email = new PersistedFormField { Id = Guid.NewGuid(), Name = "Email", KindId = Guid.Parse(TextFieldDefinition.Constants.KindId) };
            var send = new PersistedFormField { Id = Guid.NewGuid(), Name = "Send", KindId = Guid.Parse(ButtonFieldDefinition.Constants.KindId), Data = "\"Submit\"" };
            var form = new PersistedForm { Id = Guid.NewGuid(), Name = "Contact", Fields = new[] { email, send } };
            var forms = new Mock<IFormEntityRepository>();
            forms.Setup(x => x.Get(form.Id)).Returns(form);
            var logger = new CapturingLogger<BuildFormLayoutRenderModel>();
            var builder = new BuildFormLayoutRenderModel(forms.Object, fieldFactory, definitions,
                Mock.Of<ILayoutEntityRepository>(), Mock.Of<ILayoutFactory>(), logger);

            var result = builder.BuildForm(form.Id);

            Assert.NotNull(result);
            Assert.Equal(email.Id, Assert.Single(result.Fields).Field.Id);
            var reason = Assert.Single(factoryLogger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains("Send", reason.Message);
            Assert.Contains(ButtonFieldDefinition.Constants.Name, reason.Message);
            var skipped = Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(send.Id.ToString(), skipped.Message);
            Assert.Contains("Contact", skipped.Message);
            Assert.Contains(form.Id.ToString(), skipped.Message);
            Assert.Contains(send.KindId.ToString(), skipped.Message);
        }
    }
}
